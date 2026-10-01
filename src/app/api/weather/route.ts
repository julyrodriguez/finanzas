import { NextRequest, NextResponse } from "next/server";
import { WeatherData } from "@/types/weather";

const WMO_CODE_MAP: Record<number, { desc: string; icon: string }> = {
  0: { desc: "Cielo Despejado", icon: "Sun" },
  1: { desc: "Mayormente Despejado", icon: "SunMedium" },
  2: { desc: "Parcialmente Nublado", icon: "CloudSun" },
  3: { desc: "Nublado", icon: "Cloud" },
  45: { desc: "Niebla", icon: "CloudFog" },
  48: { desc: "Niebla con escarcha", icon: "CloudFog" },
  51: { desc: "Llovizna ligera", icon: "CloudDrizzle" },
  53: { desc: "Llovizna moderada", icon: "CloudDrizzle" },
  55: { desc: "Llovizna densa", icon: "CloudDrizzle" },
  61: { desc: "Lluvia leve", icon: "CloudRain" },
  63: { desc: "Lluvia moderada", icon: "CloudRain" },
  65: { desc: "Lluvia torrencial", icon: "CloudRainWind" },
  71: { desc: "Nevada ligera", icon: "CloudSnow" },
  73: { desc: "Nevada moderada", icon: "CloudSnow" },
  75: { desc: "Nevada intensa", icon: "CloudSnow" },
  80: { desc: "Chubascos leves", icon: "CloudRain" },
  81: { desc: "Chubascos moderados", icon: "CloudRain" },
  82: { desc: "Chubascos violentos", icon: "CloudLightning" },
  95: { desc: "Tormenta eléctrica", icon: "CloudLightning" },
  96: { desc: "Tormenta con granizo leve", icon: "CloudLightning" },
  99: { desc: "Tormenta con granizo fuerte", icon: "CloudLightning" },
};

function getWmoInfo(code: number): { desc: string; icon: string } {
  return WMO_CODE_MAP[code] || { desc: "Variable", icon: "Sun" };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get("lat") || "-34.6037";
  const lon = searchParams.get("lon") || "-58.3816";
  const city = searchParams.get("city") || "Buenos Aires, AR";

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,cloud_cover&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America/Argentina/Buenos_Aires&forecast_days=1`;

    const res = await fetch(url, {
      next: { revalidate: 600 }, // 10 minutes cache
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo respondió con código ${res.status}`);
    }

    const data = await res.json();
    const currentCode = data.current?.weather_code ?? 0;
    const currentWmo = getWmoInfo(currentCode);

    const sunriseStr = data.daily?.sunrise?.[0] || new Date().toISOString();
    const sunsetStr = data.daily?.sunset?.[0] || new Date().toISOString();

    const now = new Date();
    const sunriseDate = new Date(sunriseStr);
    const sunsetDate = new Date(sunsetStr);

    let solarProgress = 0.5;
    let phase: WeatherData["astronomy"]["phase"] = "day";

    const nowMs = now.getTime();
    const riseMs = sunriseDate.getTime();
    const setMs = sunsetDate.getTime();

    if (nowMs < riseMs) {
      solarProgress = -1;
      const diffMins = (riseMs - nowMs) / 60000;
      phase = diffMins <= 45 ? "dawn" : "night";
    } else if (nowMs > setMs) {
      solarProgress = -1;
      const diffMins = (nowMs - setMs) / 60000;
      phase = diffMins <= 45 ? "dusk" : "night";
    } else {
      solarProgress = Math.max(0, Math.min(1, (nowMs - riseMs) / (setMs - riseMs)));
      const minutesToSunset = (setMs - nowMs) / 60000;
      const minutesFromSunrise = (nowMs - riseMs) / 60000;

      if (minutesToSunset <= 35) {
        phase = "sunset"; // Sol poniéndose en el mar
      } else if (minutesToSunset <= 110) {
        phase = "golden-hour"; // Atardecer cálido
      } else if (minutesFromSunrise <= 45) {
        phase = "dawn";
      } else {
        phase = "day";
      }
    }

    const responseData: WeatherData = {
      current: {
        temperature: Math.round(data.current?.temperature_2m ?? 21),
        apparentTemperature: Math.round(data.current?.apparent_temperature ?? 21),
        weatherCode: currentCode,
        weatherDescription: currentWmo.desc,
        windSpeed: Math.round(data.current?.wind_speed_10m ?? 12),
        humidity: Math.round(data.current?.relative_humidity_2m ?? 55),
        cloudCover: Math.round(data.current?.cloud_cover ?? 40),
        isDay: Boolean(data.current?.is_day ?? 1),
        city,
        time: data.current?.time || new Date().toISOString(),
      },
      astronomy: {
        sunrise: sunriseStr,
        sunset: sunsetStr,
        solarProgress: parseFloat(solarProgress.toFixed(3)),
        phase,
      },
      cachedAt: new Date().toISOString(),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.warn("Fallback climático de Buenos Aires activado:", error);

    const fallbackData: WeatherData = {
      current: {
        temperature: 18,
        apparentTemperature: 17,
        weatherCode: 2,
        weatherDescription: "Parcialmente Nublado",
        windSpeed: 14,
        humidity: 58,
        cloudCover: 60,
        isDay: true,
        city,
        time: new Date().toISOString(),
      },
      astronomy: {
        sunrise: "2026-10-01T06:30",
        sunset: "2026-10-01T18:56",
        solarProgress: 0.85,
        phase: "golden-hour",
      },
      cachedAt: new Date().toISOString(),
    };

    return NextResponse.json(fallbackData);
  }
}
