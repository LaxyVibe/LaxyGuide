// Manual initialization of Decap CMS
// This approach avoids YAML config loading issues and matches the LaxyGuideCMS pattern

// Wait for CMS to be available on window
const initCMS = () => {
    if (!window.CMS) {
        console.error('Decap CMS not loaded');
        return;
    }

    const CMS = window.CMS;

    // Initialize CMS with config from config.yml converted to JS
    CMS.init({
        load_config_file: false,
        config: {
            backend: {
                name: 'github',
                repo: 'LaxyVibe/LaxyLiteGuidePWA',
                branch: 'v2'
            },
            media_folder: 'public/media',
            public_folder: '/media',
            i18n: {
                structure: 'single_file',
                locales: ['en-US', 'ja-JP', 'ko-KR', 'zh-TW', 'zh-CN'],
                default_locale: 'en-US'
            },
            collections: [
                {
                    name: 'knowledgeBase',
                    label: 'Knowledge Base',
                    folder: 'src/content/knowledgeBase',
                    create: true,
                    slug: '{{slug}}',
                    i18n: true,
                    fields: [
                        { label: 'Title', name: 'title', widget: 'string', i18n: true },
                        {
                            label: 'POIs',
                            name: 'pois',
                            widget: 'list',
                            i18n: true,
                            fields: [
                                { label: 'Number', name: 'number', widget: 'string' },
                                { label: 'Title', name: 'title', widget: 'string' },
                                { label: 'Content', name: 'content', widget: 'markdown' },
                                { label: 'Hero Image', name: 'hero', widget: 'image' },
                                { label: 'Audio URL', name: 'audio', widget: 'string', required: false },
                                { label: 'Subtitle URL', name: 'subtitle', widget: 'string', required: false },
                                {
                                    label: 'Metadata',
                                    name: 'metadata',
                                    widget: 'list',
                                    required: false,
                                    fields: [
                                        { label: 'Label', name: 'label', widget: 'string' },
                                        { label: 'Value', name: 'value', widget: 'string' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    });
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCMS);
} else {
    initCMS();
}
