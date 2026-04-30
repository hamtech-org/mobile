export const FEED_PAGE_SIZE = 5;

export interface ReelItem {
  id: string;
  thumbnail: string;
  views: string;
  name: string;
}

export const REELS_MOCK: ReelItem[] = [
  {
    id: "1",
    thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=500&fit=crop",
    views: "1.2M",
    name: "The New Mentor",
  },
  {
    id: "2",
    thumbnail: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&h=500&fit=crop",
    views: "840k",
    name: "TechCraft",
  },
  {
    id: "3",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&h=500&fit=crop",
    views: "2.4M",
    name: "Thành Duy",
  },
  {
    id: "4",
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=500&fit=crop",
    views: "560k",
    name: "JR Duy Trần",
  },
];
