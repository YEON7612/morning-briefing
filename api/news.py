# 구글뉴스 RSS를 대신 가져와주는 작은 프록시.
# 브라우저에서 news.google.com을 직접 fetch()하면 CORS에 막히기 때문에
# 같은 도메인의 이 함수를 거쳐서 가져온다. 키/로그인 불필요.
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import json

UA = "Mozilla/5.0 (compatible; morning-briefing/1.0)"
TIMEOUT = 8
MAX_ITEMS = 6


def fetch_news(keyword: str):
    url = (
        "https://news.google.com/rss/search"
        f"?q={quote(keyword)}&hl=ko&gl=KR&ceid=KR:ko"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = resp.read()

    root = ET.fromstring(data)
    items = []
    for item in root.findall("./channel/item")[:MAX_ITEMS]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_el = item.find("source")
        tag_source = (source_el.text or "").strip() if source_el is not None else ""
        # 구글뉴스 title은 거의 항상 "기사 제목 - 언론사" 형태로 온다.
        # <source> 태그가 따로 있어도 title 끝에 같은 언론사 이름이 중복으로 붙어 있으므로
        # title에서는 항상 떼어내고, 언론사 이름은 태그 쪽을 우선 신뢰한다.
        source = tag_source
        if " - " in title:
            candidate_title, candidate_source = title.rsplit(" - ", 1)
            title = candidate_title
            if not source:
                source = candidate_source
        items.append({
            "title": title,
            "link": link,
            "source": source,
            "pubDate": pub_date,
        })
    return items


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        keyword = (query.get("q", [""])[0] or "").strip()

        if not keyword:
            self._send_json(400, {"error": "missing q parameter"})
            return

        try:
            items = fetch_news(keyword)
            self._send_json(200, {"keyword": keyword, "items": items}, cache=True)
        except urllib.error.URLError as e:
            self._send_json(502, {"error": f"upstream error: {e}"})
        except ET.ParseError:
            self._send_json(502, {"error": "invalid response from news source"})
        except Exception as e:  # noqa: BLE001 - 프록시 함수라 마지막에 한 번은 넓게 잡는다
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status: int, payload: dict, cache: bool = False):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if cache:
            # 같은 키워드를 매번 새로 긁어오지 않도록 30분 정도 캐시한다.
            self.send_header("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600")
        self.end_headers()
        self.wfile.write(body)
