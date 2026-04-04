import iconsData from "@iconify-json/bx/icons.json";

type IconifyIcon = {
  body: string;
  width?: number;
  height?: number;
};

type IconifyJSON = {
  prefix: string;
  icons: Record<string, IconifyIcon>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
};

const data = iconsData as IconifyJSON;

export default function getIcon(name: string): string {
  const icon = data.icons[name] ?? (data.aliases?.[name] ? data.icons[data.aliases[name].parent] : undefined);
  if (!icon) {
    throw new Error(`[astro-icon] Icon "bx:${name}" not found in @iconify-json/bx`);
  }
  const width = icon.width ?? data.width ?? 24;
  const height = icon.height ?? data.height ?? 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
}
