import { setMedia } from "./media.js";

/* A press test form, drawn rather than shipped as an asset: a graduated sky, a
   lit sphere and a 21 step wedge, which between them exercise every part of the
   tone curve the screen has to hold. */
export function loadTestForm() {
  const c = document.createElement("canvas");
  c.width = 1000;
  c.height = 1250;
  const x = c.getContext("2d");

  const sky = x.createLinearGradient(0, 0, 0, 900);
  sky.addColorStop(0, "#0f1418");
  sky.addColorStop(0.55, "#6a7480");
  sky.addColorStop(1, "#e6e2d8");
  x.fillStyle = sky;
  x.fillRect(0, 0, 1000, 1250);

  const glow = x.createRadialGradient(700, 240, 10, 700, 240, 320);
  glow.addColorStop(0, "rgba(255,246,214,1)");
  glow.addColorStop(1, "rgba(255,246,214,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, 1000, 700);

  const sphere = x.createRadialGradient(390, 520, 20, 430, 570, 340);
  sphere.addColorStop(0, "#fff8e8");
  sphere.addColorStop(0.45, "#b9713f");
  sphere.addColorStop(1, "#1b1310");
  x.beginPath();
  x.arc(430, 570, 265, 0, Math.PI * 2);
  x.fillStyle = sphere;
  x.fill();

  x.fillStyle = "rgba(16,14,12,.85)";
  x.beginPath();
  x.moveTo(0, 880);
  x.lineTo(1000, 790);
  x.lineTo(1000, 1000);
  x.lineTo(0, 1000);
  x.closePath();
  x.fill();

  for (let i = 0; i < 21; i++) {
    const v = Math.round(255 * (i / 20));
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(28 + i * 45, 1030, 45, 92);
  }

  x.fillStyle = "#141110";
  x.fillRect(0, 1122, 1000, 128);
  x.fillStyle = "#efe9dc";
  x.font = "600 44px Georgia, 'Times New Roman', serif";
  x.fillText("TEST FORM  \u00B7  21 STEP WEDGE", 28, 1198);

  const img = new Image();
  img.onload = () => setMedia(img, img.naturalWidth, img.naturalHeight, "test-form.png");
  img.src = c.toDataURL("image/png");
}
