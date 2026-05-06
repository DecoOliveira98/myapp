import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import pt from './locales/pt';

export const LANGUAGE_STORAGE_KEY = 'languagePreference';
export type SupportedLanguage = 'en' | 'pt';
export type LanguagePreference = SupportedLanguage | 'auto';

const resources = {
    en: { translation: en },
    pt: { translation: pt },
} as const;

function resolveDeviceLanguage(): SupportedLanguage {
    const locale = Localization.getLocales?.()[0]?.languageCode?.toLowerCase?.() ?? 'en';
    return locale.startsWith('pt') ? 'pt' : 'en';
}

export async function getStoredLanguagePreference(): Promise<LanguagePreference> {
    const value = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (value === 'pt' || value === 'en' || value === 'auto') return value;
    return 'auto';
}

export async function applyLanguagePreference(preference: LanguagePreference) {
    const lng = preference === 'auto' ? resolveDeviceLanguage() : preference;
    await i18n.changeLanguage(lng);
}

export async function setLanguagePreference(preference: LanguagePreference) {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
    await applyLanguagePreference(preference);
}

export async function initializeI18n() {
    const preference = await getStoredLanguagePreference();
    const lng = preference === 'auto' ? resolveDeviceLanguage() : preference;

    if (!i18n.isInitialized) {
        await i18n.use(initReactI18next).init({
            compatibilityJSON: 'v4',
            resources,
            lng,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false,
            },
        });
    } else {
        await i18n.changeLanguage(lng);
    }

    return i18n;
}

export default i18n;
