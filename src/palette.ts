import type { Palette } from "./types";

export const BASE_PALETTES: Palette[] = [
  {
    name: "Earthy",
    colors: ["#8B4513", "#D2691E", "#DEB887", "#F5DEB3", "#556B2F", "#2F4F4F"],
  },
  {
    name: "Bold",
    colors: ["#DC143C", "#FF8C00", "#FFD700", "#228B22", "#1E90FF", "#8A2BE2"],
  },
  {
    name: "Pastel",
    colors: ["#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E8BAFF"],
  },
  {
    name: "Forest",
    colors: ["#2D5016", "#4A7C23", "#8FBC3A", "#C8D96F", "#5C4033", "#8B6914"],
  },
  {
    name: "Ocean",
    colors: ["#003545", "#006D77", "#83C5BE", "#EDF6F9", "#FFDDD2", "#E29578"],
  },
  {
    name: "Sunset",
    colors: ["#641220", "#85182A", "#E01E37", "#F26A4F", "#F7A072", "#FFDAB9"],
  },
  {
    name: "Winter",
    colors: ["#1B1F3B", "#3E517A", "#82A0BC", "#B8D4E3", "#DCEEF8", "#F0F0F0"],
  },
  {
    name: "Jewel",
    colors: ["#6A0572", "#AB0D6F", "#D4376E", "#E85D75", "#2E86AB", "#1B4332"],
  },
  {
    name: "Muted Clay",
    colors: ["#7A5C4B", "#B08B6F", "#C9B29C", "#D9CFC1", "#6F7B6A", "#4F5A4D"],
  },
  {
    name: "Dusty Sage",
    colors: ["#5B6D64", "#7C8C7A", "#9AA892", "#C3CDBE", "#CFC2B1", "#A28D7A"],
  },
  {
    name: "Weathered Denim",
    colors: ["#2F3E4E", "#4A5A68", "#6B7B86", "#8C9AA4", "#B4B0A1", "#D0C8B8"],
  },
  {
    name: "Soft Linen",
    colors: ["#6E6259", "#8C8075", "#A99D92", "#C7BCB1", "#DED6CC", "#F1ECE4"],
  },
];

export function getAllPalettes(custom: Palette[]): Palette[] {
  return [...BASE_PALETTES, ...custom];
}
