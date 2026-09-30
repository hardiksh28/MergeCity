declare module "troika-three-text" {
  export function preloadFont(opts: { font?: string; characters?: string | string[] }, callback: () => void): void;
}
