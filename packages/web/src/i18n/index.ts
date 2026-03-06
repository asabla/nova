import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export async function loadLanguage(lang: string) {
  if (i18n.hasResourceBundle(lang, "translation")) return;
  const module = await import(`./${lang}.json`);
  i18n.addResourceBundle(lang, "translation", module.default);
  i18n.changeLanguage(lang);
}

export default i18n;
