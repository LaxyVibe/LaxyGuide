import { Octokit } from '@octokit/rest';

const REPO_OWNER = 'LaxyVibe';
const REPO_NAME = 'LaxyGuide';
const TARGET_BRANCH = 'develop';

export interface GuideGeneratorInput {
  code: string;
  titles: {
    'en-US': string;
    'ja-JP': string;
    'ko-KR': string;
    'zh-TW': string;
    'zh-CN': string;
    'fr-FR': string;
  };
  guideUnderlayImage: string;
  poiCount: number;
}

export interface POIGeneratorInput {
  guide: string;
  number: string;
  title: string;
  hero?: string;
}

/**
 * Generate guide markdown frontmatter content
 */
export function generateGuideFrontmatter(input: GuideGeneratorInput): string {
  const frontmatter = {
    'en-US': {
      title: input.titles['en-US'],
      code: input.code,
      guideUnderlayImage: input.guideUnderlayImage,
    },
    'ja-JP': {
      title: input.titles['ja-JP'],
      code: input.code,
      guideUnderlayImage: input.guideUnderlayImage,
    },
    'ko-KR': {
      title: input.titles['ko-KR'],
      code: input.code,
      guideUnderlayImage: input.guideUnderlayImage,
    },
    'zh-TW': {
      title: input.titles['zh-TW'],
      code: input.code,
      guideUnderlayImage: input.guideUnderlayImage,
    },
    'zh-CN': {
      title: input.titles['zh-CN'],
      code: input.code,
      guideUnderlayImage: input.guideUnderlayImage,
    },
    'fr-FR': {
      title: input.titles['fr-FR'],
      guideUnderlayImage: input.guideUnderlayImage,
    },
  };

  return `---\n${Object.entries(frontmatter)
    .map(([lang, data]) => {
      const entries = Object.entries(data)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');
      return `${lang}:\n${entries}`;
    })
    .join('\n')}\n---\n`;
}

/**
 * Generate POI markdown frontmatter content
 */
export function generatePOIFrontmatter(input: POIGeneratorInput): string {
  const languages = ['en-US', 'ja-JP', 'ko-KR', 'zh-TW', 'zh-CN', 'fr-FR'];
  
  const frontmatter = languages.reduce((acc, lang) => {
    acc[lang] = {
      displayAudio: true,
      guide: input.guide,
      number: input.number,
      title: input.title,
      hero: input.hero || '',
      content: '',
      ttml: '',
    };
    return acc;
  }, {} as Record<string, any>);

  return `---\n${Object.entries(frontmatter)
    .map(([lang, data]) => {
      const entries = Object.entries(data)
        .map(([key, value]) => {
          if (typeof value === 'boolean') {
            return `  ${key}: ${value}`;
          }
          if (key === 'content' || key === 'ttml') {
            return `  ${key}: ${value ? `>-\n    ${value}` : value}`;
          }
          return `  ${key}: ${value}`;
        })
        .join('\n');
      return `${lang}:\n${entries}`;
    })
    .join('\n')}\n---\n`;
}

/**
 * Create or update multiple files in GitHub repository
 */
export async function createGuideFiles(
  token: string,
  guideInput: GuideGeneratorInput
): Promise<{ success: boolean; message: string; urls?: string[] }> {
  try {
    const octokit = new Octokit({ auth: token });

    // Get the latest commit SHA of the target branch
    const { data: refData } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${TARGET_BRANCH}`,
    });

    const latestCommitSha = refData.object.sha;

    // Get the tree of the latest commit
    const { data: commitData } = await octokit.git.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      commit_sha: latestCommitSha,
    });

    const baseTreeSha = commitData.tree.sha;

    // Prepare files to create
    const files: Array<{ path: string; content: string }> = [];

    // 1. Create guide markdown file
    const guideFileName = `${guideInput.code.toLowerCase()}.md`;
    const guidePath = `src/content/guides/${guideFileName}`;
    const guideContent = generateGuideFrontmatter(guideInput);
    files.push({ path: guidePath, content: guideContent });

    // 2. Create POI markdown files
    for (let i = 1; i <= guideInput.poiCount; i++) {
      const poiNumber = String(i).padStart(3, '0');
      const poiFileName = `${guideInput.code.toLowerCase()}-${poiNumber}.md`;
      const poiPath = `src/content/pois/${poiFileName}`;
      const poiContent = generatePOIFrontmatter({
        guide: guideInput.code,
        number: poiNumber,
        title: `POI ${poiNumber}`,
      });
      files.push({ path: poiPath, content: poiContent });
    }

    // Create tree with all files
    const tree = files.map((file) => ({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: file.content,
    }));

    const { data: newTree } = await octokit.git.createTree({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      base_tree: baseTreeSha,
      tree,
    });

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      message: `Generate guide: ${guideInput.code} with ${guideInput.poiCount} POIs`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // Update branch reference
    await octokit.git.updateRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${TARGET_BRANCH}`,
      sha: newCommit.sha,
    });

    const urls = files.map(
      (file) =>
        `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${TARGET_BRANCH}/${file.path}`
    );

    return {
      success: true,
      message: `Successfully created guide ${guideInput.code} with ${guideInput.poiCount} POIs`,
      urls,
    };
  } catch (error) {
    console.error('Error creating guide files:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Test GitHub API connection
 */
export async function testGitHubConnection(token: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    await octokit.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });
    return true;
  } catch (error) {
    console.error('GitHub connection test failed:', error);
    return false;
  }
}
