/**
 * Weather Service - Phase 2 Enhancement
 * Uses Open-Meteo API (free, no key required) to detect weather
 * and suggest appropriate music moods
 */

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  weatherDescription: string;
  isDay: boolean;
  mood: string;
  moodEmoji: string;
  suggestion: string;
}

// Map WMO weather codes to descriptions and moods
const WEATHER_MAP: Record<number, { desc: string; mood: string; emoji: string }> = {
  0: { desc: 'Clear sky', mood: 'sunny_vibes', emoji: '☀️' },
  1: { desc: 'Mainly clear', mood: 'sunny_vibes', emoji: '🌤️' },
  2: { desc: 'Partly cloudy', mood: 'chill', emoji: '⛅' },
  3: { desc: 'Overcast', mood: 'introspective', emoji: '☁️' },
  45: { desc: 'Foggy', mood: 'mysterious', emoji: '🌫️' },
  48: { desc: 'Icy fog', mood: 'mysterious', emoji: '🌫️' },
  51: { desc: 'Light drizzle', mood: 'rainy_chill', emoji: '🌧️' },
  53: { desc: 'Moderate drizzle', mood: 'rainy_chill', emoji: '🌧️' },
  55: { desc: 'Dense drizzle', mood: 'rainy_chill', emoji: '🌧️' },
  61: { desc: 'Slight rain', mood: 'rainy_chill', emoji: '🌧️' },
  63: { desc: 'Moderate rain', mood: 'cozy_indoors', emoji: '🌧️' },
  65: { desc: 'Heavy rain', mood: 'cozy_indoors', emoji: '🌧️' },
  71: { desc: 'Slight snow', mood: 'winter_wonderland', emoji: '🌨️' },
  73: { desc: 'Moderate snow', mood: 'winter_wonderland', emoji: '❄️' },
  75: { desc: 'Heavy snow', mood: 'winter_wonderland', emoji: '❄️' },
  77: { desc: 'Snow grains', mood: 'winter_wonderland', emoji: '🌨️' },
  80: { desc: 'Slight showers', mood: 'rainy_chill', emoji: '🌦️' },
  81: { desc: 'Moderate showers', mood: 'cozy_indoors', emoji: '🌦️' },
  82: { desc: 'Violent showers', mood: 'dramatic', emoji: '⛈️' },
  85: { desc: 'Slight snow showers', mood: 'winter_wonderland', emoji: '🌨️' },
  86: { desc: 'Heavy snow showers', mood: 'winter_wonderland', emoji: '🌨️' },
  95: { desc: 'Thunderstorm', mood: 'dramatic', emoji: '⛈️' },
  96: { desc: 'Thunderstorm with hail', mood: 'intense', emoji: '⛈️' },
  99: { desc: 'Heavy thunderstorm', mood: 'intense', emoji: '🌩️' },
};

// Mood to music prompt mapping
const MOOD_PROMPTS: Record<string, string> = {
  sunny_vibes: 'upbeat summer tracks, happy and energetic music',
  chill: 'chill downtempo, relaxing ambient music',
  introspective: 'contemplative indie, soft acoustic tracks',
  mysterious: 'atmospheric electronic, ambient soundscapes',
  rainy_chill: 'lo-fi beats, jazz for rainy days, cozy acoustic',
  cozy_indoors: 'warm acoustic, coffee shop jazz, comfort music',
  winter_wonderland: 'peaceful winter music, calm instrumentals',
  dramatic: 'epic cinematic music, powerful orchestral',
  intense: 'driving rock, high energy electronic',
};

export async function getWeatherForLocation(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
    );
    
    if (!response.ok) throw new Error('Weather API failed');
    
    const data = await response.json();
    const current = data.current_weather;
    
    const weatherInfo = WEATHER_MAP[current.weathercode] || { 
      desc: 'Unknown', 
      mood: 'chill', 
      emoji: '🌡️' 
    };
    
    // Adjust mood based on temperature
    let mood = weatherInfo.mood;
    if (current.temperature > 30) {
      mood = 'sunny_vibes'; // Hot day
    } else if (current.temperature < 5) {
      mood = 'winter_wonderland'; // Cold
    }
    
    return {
      temperature: Math.round(current.temperature),
      weatherCode: current.weathercode,
      weatherDescription: weatherInfo.desc,
      isDay: current.is_day === 1,
      mood,
      moodEmoji: weatherInfo.emoji,
      suggestion: MOOD_PROMPTS[mood] || 'relaxing music'
    };
  } catch (error) {
    console.error('Weather fetch failed:', error);
    return null;
  }
}

export async function getCurrentLocationWeather(): Promise<WeatherData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const weather = await getWeatherForLocation(
          position.coords.latitude,
          position.coords.longitude
        );
        resolve(weather);
      },
      () => {
        // If location denied, return null
        resolve(null);
      },
      { timeout: 5000 }
    );
  });
}

export function getMoodPrompt(mood: string): string {
  return MOOD_PROMPTS[mood] || MOOD_PROMPTS['chill'];
}
