export interface Destination {
  id: string;
  name: string;
  country: string;
  description: string;
  imageUrl: string;
  highlights: string[];
  vibe: string;
}

export interface ItineraryItem {
  time: string;
  activity: string;
  location: string;
  description: string;
}

export interface Itinerary {
  id: string;
  destinationId: string;
  title: string;
  days: {
    day: number;
    items: ItineraryItem[];
  }[];
}
