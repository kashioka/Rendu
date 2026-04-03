/** Convert a live SVG to a PNG data URL (reads only, no permanent DOM changes) */
export async function svgToPng(svg: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number }> {
  // Inline computed styles temporarily so they survive serialization
  const elements = svg.querySelectorAll("*");
  const savedStyles = new Map<Element, string>();
  elements.forEach((el) => {
    savedStyles.set(el, el.getAttribute("style") || "");
    const computed = getComputedStyle(el);
    let css = "";
    for (let i = 0; i < computed.length; i++) {
      const key = computed[i];
      css += `${key}:${computed.getPropertyValue(key)};`;
    }
    el.setAttribute("style", css);
  });

  const svgData = new XMLSerializer().serializeToString(svg);

  // Restore original styles immediately
  elements.forEach((el) => {
    const orig = savedStyles.get(el);
    if (orig) el.setAttribute("style", orig);
    else el.removeAttribute("style");
  });

  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0);
  URL.revokeObjectURL(url);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
  };
}
