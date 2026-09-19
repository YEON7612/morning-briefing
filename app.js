// 모닝 브리핑 — Open-Meteo 실시간 API (키/로그인 불필요)
"use strict";

const CITIES = [
  { name: "서울", lat: 37.5665, lon: 126.9780 },
  { name: "부산", lat: 35.1796, lon: 129.0756 },
  { name: "인천", lat: 37.4563, lon: 126.7052 },
  { name: "대구", lat: 35.8714, lon: 128.6014 },
  { name: "대전", lat: 36.3504, lon: 127.3845 },
  { name: "광주", lat: 35.1595, lon: 126.8526 },
  { name: "제주", lat: 33.4996, lon: 126.5312 },
];

// 날씨 요소는 새로고침해도 사라져도 되는 값이라 브라우저 저장소 대신
// 메모리에만 들고 있는다 (기본값 서울).
let current = { ...CITIES[0] };

const WMO = {
  0: ["☀️", "맑음"], 1: ["🌤️", "대체로 맑음"], 2: ["⛅", "구름 조금"], 3: ["☁️", "흐림"],
  45: ["🌫️", "안개"], 48: ["🌫️", "짙은 안개"],
  51: ["🌦️", "약한 이슬비"], 53: ["🌦️", "이슬비"], 55: ["🌧️", "강한 이슬비"],
  56: ["🌧️", "어는 이슬비"], 57: ["🌧️", "어는 이슬비"],
  61: ["🌦️", "약한 비"], 63: ["🌧️", "비"], 65: ["🌧️", "강한 비"],
  66: ["🌧️", "어는 비"], 67: ["🌧️", "어는 비"],
  71: ["🌨️", "약한 눈"], 73: ["🌨️", "눈"], 75: ["❄️", "강한 눈"], 77: ["🌨️", "진눈깨비"],
  80: ["🌦️", "약한 소나기"], 81: ["🌧️", "소나기"], 82: ["⛈️", "강한 소나기"],
  85: ["🌨️", "약한 소낙눈"], 86: ["🌨️", "소낙눈"],
  95: ["⛈️", "뇌우"], 96: ["⛈️", "뇌우(우박)"], 99: ["⛈️", "강한 뇌우(우박)"],
};
function wmo(code) { return WMO[code] || ["🌡️", "-"]; }

// 통합대기환경지수(CAI) 등급 기준 — 24시간 평균이 원칙이나,
// 여기서는 API가 주는 현재 시간 값으로 근사한다.
function pm10Grade(v) {
  if (v <= 30) return ["좋음", "g-good"];
  if (v <= 80) return ["보통", "g-mod"];
  if (v <= 150) return ["나쁨", "g-bad"];
  return ["매우나쁨", "g-vbad"];
}
function pm25Grade(v) {
  if (v <= 15) return ["좋음", "g-good"];
  if (v <= 35) return ["보통", "g-mod"];
  if (v <= 75) return ["나쁨", "g-bad"];
  return ["매우나쁨", "g-vbad"];
}

const $ = (id) => document.getElementById(id);

function greetByHour(h) {
  if (h >= 5 && h < 11) return "좋은 아침이에요 👋";
  if (h >= 11 && h < 17) return "오늘 하루도 힘내세요 ☀️";
  if (h >= 17 && h < 21) return "저녁 잘 보내세요 🌇";
  return "늦은 시간이네요 🌙";
}

function renderHeader() {
  const now = new Date();
  $("greet").textContent = greetByHour(now.getHours());
  $("date-line").textContent = now.toLocaleDateString("ko-KR", {
    month: "long", day: "numeric", weekday: "long",
  });
  $("loc-name").textContent = current.name;
}

function weatherURL(lat, lon) {
  return "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=Asia%2FSeoul&forecast_days=7";
}
function airURL(lat, lon) {
  return "https://air-quality-api.open-meteo.com/v1/air-quality" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=pm10,pm2_5&timezone=Asia%2FSeoul";
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function renderNow(w) {
  const c = w.current;
  const [emoji, desc] = wmo(c.weather_code);
  const todayMax = Math.round(w.daily.temperature_2m_max[0]);
  const todayMin = Math.round(w.daily.temperature_2m_min[0]);
  return `
    <div class="now-card">
      <div class="now-icon">${emoji}</div>
      <div class="now-temp">${Math.round(c.temperature_2m)}°</div>
      <div class="now-desc">${desc} · 체감 ${Math.round(c.apparent_temperature)}°</div>
      <div class="now-sub">
        <span>최고 <b>${todayMax}°</b></span>
        <span>최저 <b>${todayMin}°</b></span>
        <span>습도 <b>${Math.round(c.relative_humidity_2m)}%</b></span>
      </div>
    </div>`;
}

function renderAir(a) {
  const pm10 = Math.round(a.current.pm10);
  const pm25 = Math.round(a.current.pm2_5);
  const [g10, c10] = pm10Grade(pm10);
  const [g25, c25] = pm25Grade(pm25);
  return `
    <div class="air-card">
      <p class="air-title">미세먼지 (현재)</p>
      <div class="air-row">
        <div class="air-item">
          <div class="air-label">미세먼지 PM10</div>
          <div class="air-value">${pm10}</div>
          <div class="air-grade ${c10}">${g10}</div>
        </div>
        <div class="air-item">
          <div class="air-label">초미세먼지 PM2.5</div>
          <div class="air-value">${pm25}</div>
          <div class="air-grade ${c25}">${g25}</div>
        </div>
      </div>
    </div>`;
}

function renderWeek(w) {
  const days = w.daily.time.map((t, i) => {
    const d = new Date(t + "T00:00:00");
    const isToday = i === 0;
    const name = isToday ? "오늘" : d.toLocaleDateString("ko-KR", { weekday: "short" });
    const [emoji] = wmo(w.daily.weather_code[i]);
    const pop = w.daily.precipitation_probability_max[i];
    const max = Math.round(w.daily.temperature_2m_max[i]);
    const min = Math.round(w.daily.temperature_2m_min[i]);
    return `
      <div class="day-card ${isToday ? "today" : ""}">
        <div class="day-name">${name}</div>
        <div class="day-icon">${emoji}</div>
        <div class="day-pop">${pop != null && pop > 0 ? "💧" + pop + "%" : ""}</div>
        <div class="day-max">${max}°</div>
        <div class="day-min">${min}°</div>
      </div>`;
  }).join("");
  return `<p class="week-title">7일 예보</p><div class="week-scroll">${days}</div>`;
}

async function load() {
  renderHeader();
  $("refresh-line").hidden = true;
  $("content").innerHTML = `
    <div class="state-msg" id="state-loading">
      <span class="big">⛅</span>
      ${current.name} 날씨를 불러오는 중…
    </div>`;

  try {
    const [w, a] = await Promise.all([
      fetchJSON(weatherURL(current.lat, current.lon)),
      fetchJSON(airURL(current.lat, current.lon)),
    ]);
    $("content").innerHTML = renderNow(w) + renderAir(a) + renderWeek(w);
    $("refresh-line").hidden = false;
    $("updated-at").textContent = "· " + new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit", minute: "2-digit",
    }) + " 기준";
  } catch (err) {
    $("content").innerHTML = `
      <div class="state-msg">
        <span class="big">😵</span>
        날씨 정보를 불러오지 못했습니다.<br>
        <span class="small">${err.message}</span>
        <div><button class="retry-btn" id="btn-retry">다시 시도</button></div>
      </div>`;
    $("btn-retry").addEventListener("click", load);
  }
}

function openSheet() {
  const list = $("city-list");
  list.innerHTML = CITIES.map((c) => `
    <button class="city-item" data-name="${c.name}"
      aria-pressed="${c.name === current.name}">${c.name}</button>
  `).join("");
  list.querySelectorAll(".city-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const picked = CITIES.find((c) => c.name === btn.dataset.name);
      if (picked) current = { ...picked };
      $("sheet-backdrop").hidden = true;
      load();
    });
  });
  $("sheet-backdrop").hidden = false;
}

$("btn-loc").addEventListener("click", openSheet);
$("sheet-close").addEventListener("click", () => { $("sheet-backdrop").hidden = true; });
$("sheet-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "sheet-backdrop") $("sheet-backdrop").hidden = true;
});
$("btn-refresh").addEventListener("click", load);

load();
