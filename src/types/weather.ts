export interface WeatherCurrent {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
  humidity: number;
  cloudCover: number;
  isDay: boolean;
  city: string;
  time: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  astronomy: {
    sunrise: string;
    sunset: string;
    solarProgress: number; // 0 (sunrise) to 1 (sunset), or -1 if night
    phase: "dawn" | "day" | "golden-hour" | "sunset" | "dusk" | "night";
  };
  cachedAt: string;
}
