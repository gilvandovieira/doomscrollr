type Oklch = {
  l: number;
  c: number;
  h: number;
};

type Rgb = readonly [number, number, number];

const STYLES = await Deno.readTextFile(new URL("../styles.css", import.meta.url));
const LIGHT = parseTheme(":root {");
const DARK = { ...LIGHT, ...parseTheme(':root[data-theme="dark"] {') };

Deno.test("core text token pairings meet WCAG AA contrast", () => {
  const failures: string[] = [];

  for (const [themeName, theme] of Object.entries({ light: LIGHT, dark: DARK })) {
    for (const surface of ["page", "paper", "newsprint"] as const) {
      checkPair(failures, themeName, theme, "ink", surface, 4.5);
      checkPair(failures, themeName, theme, "muted", surface, 4.5);
      checkPair(failures, themeName, theme, "signal", surface, 4.5);
      checkPair(failures, themeName, theme, "oxide", surface, 4.5);
    }

    checkAlphaSurfacePair(failures, themeName, theme, "ink", "signal", "accent-soft", "paper", 4.5);
    checkAlphaSurfacePair(
      failures,
      themeName,
      theme,
      "ink",
      "signal",
      "accent-soft",
      "newsprint",
      4.5,
    );

    checkPair(failures, themeName, theme, "pitch", "signal", 4.5);
    checkPair(failures, themeName, theme, "pitch", "oxide", 4.5);

    for (const kind of ["kind-text", "kind-image", "kind-youtube", "kind-repost", "kind-quote"]) {
      checkPair(failures, themeName, theme, "pitch-ink", kind, 4.5);
    }

    checkRawPair(
      failures,
      themeName,
      theme,
      "pitch-ink",
      hexToLinearRgb("#25d366"),
      "whatsapp-green",
      4.5,
    );
    checkRawPair(
      failures,
      themeName,
      theme,
      "pitch-ink",
      hexToLinearRgb("#1ebd5a"),
      "whatsapp-green-hover",
      4.5,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Contrast failures:\n${failures.join("\n")}`);
  }
});

function parseTheme(selector: string): Record<string, Oklch | string> {
  const block = readBlock(STYLES, selector);
  const tokens: Record<string, Oklch | string> = {};
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const [, name, rawValue] = match;
    if (
      !name.startsWith("color-") && !name.startsWith("kind-") && name !== "muted" &&
      name !== "accent-soft"
    ) {
      continue;
    }
    const value = rawValue.trim();
    tokens[name] = value.startsWith("oklch(") ? value : parseOklch(value);
  }
  return tokens;
}

function readBlock(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex === -1) throw new Error(`Could not find CSS selector ${selector}`);
  const openIndex = css.indexOf("{", selectorIndex);
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(openIndex + 1, index);
    }
  }

  throw new Error(`Could not parse CSS block ${selector}`);
}

function parseOklch(value: string): Oklch {
  const match = value.match(/^([\d.]+)%\s+([\d.]+)\s+([\d.]+)/);
  if (!match) throw new Error(`Expected OKLCH channel list, got ${value}`);
  return { l: Number(match[1]) / 100, c: Number(match[2]), h: Number(match[3]) };
}

function checkPair(
  failures: string[],
  themeName: string,
  theme: Record<string, Oklch | string>,
  textToken: string,
  surfaceToken: string,
  minimum: number,
) {
  const surface = tokenRgb(theme, surfaceToken);
  const text = textToken === "muted"
    ? composite(tokenRgb(theme, "ink"), surface, mutedAlpha(theme))
    : tokenRgb(theme, textToken);
  checkRatio(failures, themeName, textToken, text, surfaceToken, surface, minimum);
}

function checkRawPair(
  failures: string[],
  themeName: string,
  theme: Record<string, Oklch | string>,
  textToken: string,
  surface: Rgb,
  surfaceName: string,
  minimum: number,
) {
  const text = tokenRgb(theme, textToken);
  checkRatio(failures, themeName, textToken, text, surfaceName, surface, minimum);
}

function checkAlphaSurfacePair(
  failures: string[],
  themeName: string,
  theme: Record<string, Oklch | string>,
  textToken: string,
  tintToken: string,
  alphaToken: string,
  baseSurfaceToken: string,
  minimum: number,
) {
  const baseSurface = tokenRgb(theme, baseSurfaceToken);
  const surface = composite(
    tokenRgb(theme, tintToken),
    baseSurface,
    derivedAlpha(theme, alphaToken),
  );
  const text = tokenRgb(theme, textToken);
  checkRatio(
    failures,
    themeName,
    textToken,
    text,
    `${alphaToken} over ${baseSurfaceToken}`,
    surface,
    minimum,
  );
}

function checkRatio(
  failures: string[],
  themeName: string,
  textName: string,
  text: Rgb,
  surfaceName: string,
  surface: Rgb,
  minimum: number,
) {
  const ratio = contrast(text, surface);
  if (ratio + 0.01 < minimum) {
    failures.push(
      `${themeName}: ${textName} on ${surfaceName} is ${ratio.toFixed(2)}:1, expected ` +
        `${minimum}:1`,
    );
  }
}

function tokenRgb(theme: Record<string, Oklch | string>, name: string): Rgb {
  const value = theme[`color-${name}`] ?? theme[name];
  if (!value || typeof value === "string") throw new Error(`Missing OKLCH token ${name}`);
  return oklchToLinearRgb(value);
}

function mutedAlpha(theme: Record<string, Oklch | string>): number {
  return derivedAlpha(theme, "muted");
}

function derivedAlpha(theme: Record<string, Oklch | string>, name: string): number {
  const rawValue = theme[name];
  if (typeof rawValue !== "string") throw new Error(`Missing derived --${name} token`);
  const match = rawValue.match(/\/\s*([\d.]+)\)/);
  if (!match) throw new Error(`Could not parse --${name} alpha from ${rawValue}`);
  return Number(match[1]);
}

function oklchToLinearRgb({ l, c, h }: Oklch): Rgb {
  const hue = h * Math.PI / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.2914855480 * b;

  const lLinear = lPrime ** 3;
  const mLinear = mPrime ** 3;
  const sLinear = sPrime ** 3;

  return [
    clamp(4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear),
    clamp(-1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear),
    clamp(-0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear),
  ];
}

function hexToLinearRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) =>
    srgbToLinear(Number.parseInt(value.slice(index, index + 2), 16) / 255)
  );
  return [channels[0], channels[1], channels[2]];
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
  ];
}

function contrast(first: Rgb, second: Rgb): number {
  const firstLum = luminance(first);
  const secondLum = luminance(second);
  return (Math.max(firstLum, secondLum) + 0.05) / (Math.min(firstLum, secondLum) + 0.05);
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
