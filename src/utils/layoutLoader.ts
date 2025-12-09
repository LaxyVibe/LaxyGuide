import matter from 'gray-matter';

// Define interfaces for the color palette structure
export interface ColorShades {
    '100': string;
    '200': string;
    '300': string;
    '400': string;
    '500': string;
    '600': string;
    Alpha: string;
}

export interface NeutralShades extends ColorShades {
    '700': string;
    '800': string;
    '900': string;
    '1000': string;
}

export interface StatusColor {
    '100': string;
    '200'?: string;
    Alpha: string;
}

export interface StatusUtilityColors {
    Red: StatusColor;
    Yellow: StatusColor;
    Green: Omit<StatusColor, '200'>;
}

export interface MiscellaneousColors {
    BS_50: string;
    BS_100: string;
    OPAM_Theme_Colour: string;
}

export interface LayoutColors {
    Primary: ColorShades;
    Secondary: ColorShades;
    Third: ColorShades;
    Neutral: NeutralShades;
    StatusUtility: StatusUtilityColors;
    Miscellaneous: MiscellaneousColors;
}

/**
 * Load layout color configuration from markdown file
 * @returns LayoutColors object or null if not found
 */
export async function loadLayoutColors(): Promise<LayoutColors | null> {
    try {
        // Load the layout markdown file
        const layoutFiles = import.meta.glob('/src/content/layout/*.md', {
            eager: true,
            query: '?raw',
            import: 'default'
        });

        const layoutPaths = Object.keys(layoutFiles);

        if (layoutPaths.length === 0) {
            console.error('No layout files found in src/content/layout');
            return null;
        }

        // Get the first (and should be only) layout file
        const layoutContent = layoutFiles[layoutPaths[0]] as string;
        const layoutParsed = matter(layoutContent);
        const layoutData = layoutParsed.data as LayoutColors;

        return layoutData;
    } catch (error) {
        console.error('Error loading layout colors:', error);
        return null;
    }
}
