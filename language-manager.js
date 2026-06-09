/**
 * Language Manager - GovDocs Pro
 * Handles fetching and applying translations.
 */

const SUPPORTED_LANGS = ['en', 'gu', 'hi'];
const STORAGE_KEY = 'govdocs_lang';

export const LanguageManager = {
    currentLang: 'gu',
    translations: {},

    async init() {
        const savedLang = localStorage.getItem(STORAGE_KEY);
        if (savedLang && SUPPORTED_LANGS.includes(savedLang)) {
            this.currentLang = savedLang;
        } else {
            // Default to Gujarati if no valid language is saved
            this.currentLang = 'gu';
        }
        
        await this.loadTranslations(this.currentLang);
        this.applyTranslations();
        this.updateHtmlLang();
    },

    async loadTranslations(lang) {
        try {
            const response = await fetch(`${lang}.json`);
            if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
            this.translations[lang] = await response.json();
        } catch (error) {
            console.error(error);
            // Fallback to English if the requested language file fails
            if (lang !== 'en') {
                await this.loadTranslations('en');
            }
        }
    },

    async setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang) || lang === this.currentLang) return;
        
        this.currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        
        if (!this.translations[lang]) {
            await this.loadTranslations(lang);
        }
        
        this.applyTranslations();
        this.updateHtmlLang();
    },

    applyTranslations() {
        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            el.textContent = this.translations[this.currentLang]?.[key] || this.translations['en']?.[key] || el.textContent;
        });
    },

    updateHtmlLang() {
        document.documentElement.lang = this.currentLang;
    }
};