import localFont from "next/font/local";

export const spectral = localFont({
  src: [
    { path: "../fonts/spectral/Spectral-ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "../fonts/spectral/Spectral-ExtraLightItalic.ttf", weight: "200", style: "italic" },
    { path: "../fonts/spectral/Spectral-Light.ttf", weight: "300", style: "normal" },
    { path: "../fonts/spectral/Spectral-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "../fonts/spectral/Spectral-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/spectral/Spectral-Italic.ttf", weight: "400", style: "italic" },
    { path: "../fonts/spectral/Spectral-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/spectral/Spectral-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../fonts/spectral/Spectral-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/spectral/Spectral-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "../fonts/spectral/Spectral-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/spectral/Spectral-BoldItalic.ttf", weight: "700", style: "italic" },
    { path: "../fonts/spectral/Spectral-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../fonts/spectral/Spectral-ExtraBoldItalic.ttf", weight: "800", style: "italic" },
  ],
  variable: "--font-spectral",
  display: "swap",
});

export const abeezee = localFont({
  src: [
    { path: "../fonts/abeezee/ABeeZee-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/abeezee/ABeeZee-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-abeezee",
  display: "swap",
});

export const outfit = localFont({
  src: [{ path: "../fonts/outfit/Outfit-VariableFont_wght.ttf", weight: "100 900", style: "normal" }],
  variable: "--font-outfit",
  display: "swap",
});
