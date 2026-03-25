import { GoogleGenAI, Type } from "@google/genai";
import { Destination, Itinerary } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function curateDestinations(query: string): Promise<Destination[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Curate 3 premium travel destinations for: ${query}. 
    Provide detailed descriptions, highlights, and a "vibe" (e.g., "Serene & Minimalist", "Vibrant & Brutalist").`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            country: { type: Type.STRING },
            description: { type: Type.STRING },
            imageUrl: { type: Type.STRING, description: "A high-quality Unsplash image URL related to the destination" },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            vibe: { type: Type.STRING },
          },
          required: ["id", "name", "country", "description", "imageUrl", "highlights", "vibe"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

export async function generateItinerary(destination: Destination): Promise<Itinerary> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a 3-day premium editorial itinerary for ${destination.name}, ${destination.country}. 
    Focus on unique, high-end experiences.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          destinationId: { type: Type.STRING },
          title: { type: Type.STRING },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING },
                      activity: { type: Type.STRING },
                      location: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ["time", "activity", "location", "description"],
                  },
                },
              },
              required: ["day", "items"],
            },
          },
        },
        required: ["id", "destinationId", "title", "days"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
