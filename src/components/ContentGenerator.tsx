import React, { useState, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/Accordion';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import Papa from 'papaparse';

interface BlogData {
    title: string;
    url: string;
    tags: string[];
}

interface ClaudeResponse {
    id: string;
    type: string;
    role: string;
    content: Array<{
        type: string;
        text: string;
    }>;
}

interface ProjectData {
    general: {
        language: 'russian' | 'english';
        projectName: string;
        projectType: string;
        projectSummary: string;
        blogTheme: string;
        keyFeatures: string;
    };
    audience: {
        summary: string;
        painPoints: string;
        productUsage: string;
    };
}

interface SeoData {
    keywords: {
        csvData: any[];
        mainKeyword: string;
        relatedKeywords: string[];
    };
    competitors: {
        urls: string[];
        keyPoints: Record<string, string>;
    };
    blogData: BlogData[];
}

interface AddedLink {
    original: string;
    url: string;
    reason: string;
}

const DEFAULT_PROJECT_DATA: ProjectData = {
    general: {
        language: 'russian',
        projectName: 'Jabka Skin',
        projectType: 'Gaming CS 2 guides blog',
        projectSummary: 'JABKA SKIN is a premium lootbox and crash site offering various gaming modes such as CS2 cases, CS2 case battles, CS:GO Roulette, CS:GO jackpot, CS:GO double, CS Crash, CS Wheel, Mines, and Chickens. The platform allows players to enhance their inventory with skins and offers bonuses like promo codes, free cases, and VIP club membership.',
        blogTheme: 'The blog focuses on CS2 guides, maps callouts, strategies, console commands and performance guides. It covers topics like cs2 maps, cs grenades, cs map positions, cs console commands and basic guides.',
        keyFeatures: 'CS2 cases, CS2 case battles, CS:GO Roulette, CS Crash, CS Wheel, Mines, Chickens, skin betting, promo codes, free cases, VIP club with cashback and bonuses, multiple deposit methods including cryptocurrency.'
    },
    audience: {
        summary: 'The target audience primarily consists of young adults and teenagers who are passionate about online gaming, particularly those engaged in games like CS:GO.',
        painPoints: 'Difficulty finding trustworthy and exciting gaming platforms, limited access to desirable in-game items, desire for engaging community interactions',
        productUsage: 'The audience integrates the product into their lifestyle by using it as a primary platform for gaming and entertainment.'
    }
};

const sendToClaude = async (apiKey: string, prompt: string): Promise<string> => {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data: ClaudeResponse = await response.json();
        return data.content[0]?.text || '';
    } catch (error) {
        console.error('Error calling Claude API:', error);
        throw error;
    }
};

const ContentGenerator: React.FC = () => {
    const [competitorPages, setCompetitorPages] = useState<{
        [url: string]: string;
    }>({});
    const [sitemaps, setSitemaps] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [apiKey, setApiKey] = useState('');
    const [projectData, setProjectData] = useState<ProjectData>(DEFAULT_PROJECT_DATA);
    const [seoData, setSeoData] = useState<SeoData>({
        keywords: {
            csvData: [],
            mainKeyword: '',
            relatedKeywords: []
        },
        competitors: {
            urls: [],
            keyPoints: {}
        },
        blogData: []
    });
    const [finalPrompt, setFinalPrompt] = useState('');
    const [addedLinks, setAddedLinks] = useState<AddedLink[]>([]);

    const handleBlogDataUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = e.target?.result;
                    if (typeof result === 'string') {
                        const data = JSON.parse(result) as BlogData[];
                        if (Array.isArray(data) && data.every(item =>
                            item.title && item.url && Array.isArray(item.tags)
                        )) {
                            setSeoData(prev => ({
                                ...prev,
                                blogData: [...prev.blogData, ...data]
                            }));
                        }
                    }
                } catch (error) {
                    console.error('Invalid JSON format:', error);
                }
            };
            reader.readAsText(file);
        });
    }, []);

    const generatePrompt = useCallback((
        files: {
            keywords: any[];
            blogData: BlogData[];
            sitemaps: string[];
            competitorPages: Array<[string, string]>;
        }) => {
        const skinNameRegex = /([A-Za-z0-9-]+)\s*\|\s*([A-Za-z0-9-]+)/;
        const weaponTypes = ['AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Desert Eagle', 'USP-S', 'Glock-18', 'MAG-7'];
        const newAddedLinks: AddedLink[] = [];

        const processContent = (text: string): string => {
            let processedText = text;
            const matches = text.match(new RegExp(skinNameRegex, 'g')) || [];

            matches.forEach(match => {
                const matchResult = match.match(skinNameRegex);
                if (matchResult) {
                    const [_, weapon, skin] = matchResult;
                    if (weaponTypes.some(w => weapon.toLowerCase().includes(w.toLowerCase()))) {
                        const linkUrl = `/cs2-wiki/weapons/${weapon.toLowerCase()}/${skin.toLowerCase()}`;
                        processedText = processedText.replace(match, `[${match}](${linkUrl})`);
                        newAddedLinks.push({
                            original: match,
                            url: linkUrl,
                            reason: `Found weapon skin reference: ${match}`
                        });
                    }
                }
            });

            return processedText;
        };

        const prompt = `I need a comprehensive article about ${seoData.keywords.mainKeyword}. Here's the data package:

<keywords>
Main keyword: ${seoData.keywords.mainKeyword}
Related keywords: ${seoData.keywords.relatedKeywords.join(', ')}
</keywords>

<competitors>
Top ranking URLs:
${seoData.competitors.urls.map((url, i) => `${i + 1}. ${url} - ${seoData.competitors.keyPoints[url]}`).join('\n')}
</competitors>

<internal_links>
Related blog posts:
${seoData.blogData.map(post => `- ${post.url} - ${post.title} [tags: ${post.tags.join(', ')}]`).join('\n')}
</internal_links>

<project_context>
Language: ${projectData.general.language}
Project Type: ${projectData.general.projectType}
Target Audience: ${projectData.audience.summary}
Pain Points: ${projectData.audience.painPoints}
</project_context>

<style_guidelines>
Tone: Professional but accessible to gamers
Formatting: Use proper heading hierarchy (H2, H3)
Required terminology: CS2-specific terms and weapon names
Link suggestions: Add relevant skin/weapon wiki links when mentioned
</style_guidelines>

<documents>
${files.keywords.length > 0 ? `
<document index="1">
<source>keywords.csv</source>
<document_content>${Papa.unparse(files.keywords)}</document_content>
</document>
` : ''}

${files.blogData.length > 0 ? `
<document index="2">
<source>blog_data.json</source>
<document_content>${JSON.stringify(files.blogData, null, 2)}</document_content>
</document>
` : ''}

${files.sitemaps.map((sitemap: string, index: number) => `
<document index="${index + 3}">
<source>sitemap${index + 1}.xml</source>
<document_content>${sitemap}</document_content>
</document>
`).join('\n')}
</documents>

${Object.entries(files.competitorPages).map(([url, html], index) => `
<document index="${index + 3 + files.sitemaps.length}">
<source>${url.replace(/[^a-zA-Z0-9]/g, '_')}.html</source>
<document_content>${html}</document_content>
</document>
`).join('\n')}

Special Instructions:
1. When mentioning specific weapon skins, link to their wiki pages
2. Include relevant internal links from the blog posts provided
3. Maintain natural keyword placement
4. Use gaming terminology appropriately
5. Include practical examples and tips`;

        setFinalPrompt(processContent(prompt));
        setAddedLinks(newAddedLinks);
    }, [projectData, seoData]);

    const renderStepContent = () => {
        switch(currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">API Configuration</h2>
                        <div className="space-y-2">
                            <label className="block">Claude API Key</label>
                            <input
                                type="password"
                                className="w-full p-2 border rounded"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Claude API key"
                            />
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">Project Configuration</h2>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="general">
                                <AccordionTrigger>General Information</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium">Language</label>
                                            <select
                                                className="w-full p-2 border rounded mt-1"
                                                value={projectData.general.language}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    general: { ...prev.general, language: e.target.value as 'russian' | 'english' }
                                                }))}
                                            >
                                                <option value="russian">Russian</option>
                                                <option value="english">English</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Project Name</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border rounded mt-1"
                                                value={projectData.general.projectName}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    general: { ...prev.general, projectName: e.target.value }
                                                }))}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Project Type</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border rounded mt-1"
                                                value={projectData.general.projectType}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    general: { ...prev.general, projectType: e.target.value }
                                                }))}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Project Summary</label>
                                            <textarea
                                                className="w-full p-2 border rounded mt-1"
                                                rows={4}
                                                value={projectData.general.projectSummary}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    general: { ...prev.general, projectSummary: e.target.value }
                                                }))}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Blog Theme</label>
                                            <textarea
                                                className="w-full p-2 border rounded mt-1"
                                                rows={3}
                                                value={projectData.general.blogTheme}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    general: { ...prev.general, blogTheme: e.target.value }
                                                }))}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Key Features</label>
                                            <textarea
                                                className="w-full p-2 border rounded mt-1"
                                                rows={3}
                                                value={projectData.general.keyFeatures}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    general: { ...prev.general, keyFeatures: e.target.value }
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="audience">
                                <AccordionTrigger>Target Audience</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium">Target Audience Summary</label>
                                            <textarea
                                                className="w-full p-2 border rounded mt-1"
                                                rows={6}
                                                value={projectData.audience.summary}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    audience: { ...prev.audience, summary: e.target.value }
                                                }))}
                                                placeholder="Describe your target audience's demographics, interests, and behaviors"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Pain Points</label>
                                            <textarea
                                                className="w-full p-2 border rounded mt-1"
                                                rows={4}
                                                value={projectData.audience.painPoints}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    audience: { ...prev.audience, painPoints: e.target.value }
                                                }))}
                                                placeholder="List the main challenges and problems your audience faces"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Product Usage</label>
                                            <textarea
                                                className="w-full p-2 border rounded mt-1"
                                                rows={4}
                                                value={projectData.audience.productUsage}
                                                onChange={(e) => setProjectData(prev => ({
                                                    ...prev,
                                                    audience: { ...prev.audience, productUsage: e.target.value }
                                                }))}
                                                placeholder="Describe how your audience uses the product in their daily life"
                                            />
                                            <p className="text-sm text-gray-500 mt-1">
                                                Include specific examples of how users integrate the product into their routine
                                            </p>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">Blog Data Upload</h2>
                        <div className="border-2 border-dashed rounded-lg p-6">
                            <input
                                type="file"
                                multiple
                                accept=".json"
                                onChange={handleBlogDataUpload}
                                className="hidden"
                                id="blog-data-upload"
                            />
                            <label htmlFor="blog-data-upload" className="cursor-pointer">
                                <div className="text-center">
                                    <p>Drop blog JSON files or click to upload</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        {/*Format: [{"title": "string", "url": "string", "tags": ["string"]}]*/}
                                    </p>
                                </div>
                            </label>
                        </div>

                        {seoData.blogData.length > 0 && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold mb-2">Uploaded Blog Data:</h3>
                                <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Title</th>
                                            <th className="text-left p-2">Tags</th>
                                            <th className="text-left p-2"></th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {seoData.blogData.map((blog, index) => (
                                            <tr key={index} className="border-b">
                                                <td className="p-2">{blog.title}</td>
                                                <td className="p-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {blog.tags.map((tag, i) => (
                                                            <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {tag}
                    </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    <button
                                                        className="text-red-600 hover:text-red-800"
                                                        onClick={() => setSeoData(prev => ({
                                                            ...prev,
                                                            blogData: prev.blogData.filter((_, i) => i !== index)
                                                        }))}
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">Sitemap Configuration</h2>
                        <div
                            className="border-2 border-dashed rounded-lg p-8"
                            onDrop={(e) => {
                                e.preventDefault();
                                const files = Array.from(e.dataTransfer.files);
                                files.forEach(file => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        const content = e.target?.result as string;
                                        setSitemaps(prev => [...prev, content]);
                                    };
                                    reader.readAsText(file);
                                });
                            }}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <input
                                type="file"
                                multiple
                                accept=".xml"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    files.forEach(file => {
                                        const reader = new FileReader();
                                        reader.onload = (e) => {
                                            const content = e.target?.result as string;
                                            setSitemaps(prev => [...prev, content]);
                                        };
                                        reader.readAsText(file);
                                    });
                                }}
                                className="hidden"
                                id="sitemap-upload"
                            />
                            <label htmlFor="sitemap-upload" className="cursor-pointer">
                                <div className="text-center">
                                    <p>Drop sitemap files or click to upload</p>
                                    <p className="text-sm text-gray-500 mt-2">Upload your sitemap.xml files</p>
                                </div>
                            </label>
                        </div>

                        {sitemaps.length > 0 && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold mb-2">Uploaded Sitemaps:</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    {sitemaps.map((_, index) => (
                                        <li key={index} className="text-sm">
                                            sitemap{index + 1}.xml
                                            <button
                                                className="ml-2 text-red-600 hover:text-red-800"
                                                onClick={() => setSitemaps(prev => prev.filter((_, i) => i !== index))}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">SEO Data</h2>
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Keywords Data</h3>
                                <div
                                    className="border-2 border-dashed rounded-lg p-6"
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files[0];
                                        if (file) {
                                            Papa.parse(file, {
                                                complete: (results) => {
                                                    setSeoData(prev => ({
                                                        ...prev,
                                                        keywords: {
                                                            ...prev.keywords,
                                                            csvData: results.data
                                                        }
                                                    }));
                                                },
                                                header: true,
                                                dynamicTyping: true,
                                                skipEmptyLines: true,
                                                delimitersToGuess: [',', '\t', '|', ';']
                                            });
                                        }
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                Papa.parse(file, {
                                                    complete: (results) => {
                                                        setSeoData(prev => ({
                                                            ...prev,
                                                            keywords: {
                                                                ...prev.keywords,
                                                                csvData: results.data
                                                            }
                                                        }));
                                                    },
                                                    header: true,
                                                    dynamicTyping: true,
                                                    skipEmptyLines: true,
                                                    delimitersToGuess: [',', '\t', '|', ';']
                                                });
                                            }
                                        }}
                                        className="hidden"
                                        id="keyword-csv-upload"
                                    />
                                    <label htmlFor="keyword-csv-upload" className="cursor-pointer">
                                        <div className="text-center">
                                            <p>Drop Ahrefs keyword CSV or click to upload</p>
                                            <p className="text-sm text-gray-500 mt-2">CSV should contain keyword data and search volumes</p>
                                            {seoData.keywords.csvData.length > 0 && (
                                                <p className="text-sm text-green-600 mt-2">
                                                    ✓ Loaded {seoData.keywords.csvData.length} keywords
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {/* Main Keyword */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">Main Target Keyword</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded"
                                        value={seoData.keywords.mainKeyword}
                                        onChange={(e) => setSeoData(prev => ({
                                            ...prev,
                                            keywords: {
                                                ...prev.keywords,
                                                mainKeyword: e.target.value
                                            }
                                        }))}
                                        placeholder="Enter main keyword (e.g., 'консольные команды кс 2')"
                                    />
                                </div>

                                {/* Related Keywords */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">Related Keywords</label>
                                    <textarea
                                        className="w-full p-2 border rounded h-24"
                                        value={seoData.keywords.relatedKeywords.join('\n')}
                                        onChange={(e) => setSeoData(prev => ({
                                            ...prev,
                                            keywords: {
                                                ...prev.keywords,
                                                relatedKeywords: e.target.value.split('\n').filter(k => k.trim())
                                            }
                                        }))}
                                        placeholder="Enter related keywords (one per line)"
                                    />
                                </div>
                            </div>

                            {/* Competitors Analysis */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Competitor Analysis</h3>

                                {/* Competitor URLs */}
                                <div className="space-y-4">
                                    {seoData.competitors.urls.map((url, index) => (
                                        <div key={index} className="flex gap-4">
                                            <div className="flex-grow">
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border rounded mb-2"
                                                    value={url}
                                                    onChange={(e) => {
                                                        const newUrls = [...seoData.competitors.urls];
                                                        newUrls[index] = e.target.value;
                                                        setSeoData(prev => ({
                                                            ...prev,
                                                            competitors: {
                                                                ...prev.competitors,
                                                                urls: newUrls
                                                            }
                                                        }));
                                                    }}
                                                    placeholder="Competitor URL"
                                                />
                                                <textarea
                                                    className="w-full p-2 border rounded"
                                                    value={seoData.competitors.keyPoints[url] || ''}
                                                    onChange={(e) => setSeoData(prev => ({
                                                        ...prev,
                                                        competitors: {
                                                            ...prev.competitors,
                                                            keyPoints: {
                                                                ...prev.competitors.keyPoints,
                                                                [url]: e.target.value
                                                            }
                                                        }
                                                    }))}
                                                    placeholder="Key points covered in this article"
                                                />
                                            </div>
                                            <button
                                                className="text-red-600 hover:text-red-800"
                                                onClick={() => {
                                                    setSeoData(prev => {
                                                        const newUrls = prev.competitors.urls.filter((_, i) => i !== index);
                                                        const newKeyPoints = { ...prev.competitors.keyPoints };
                                                        delete newKeyPoints[url];
                                                        return {
                                                            ...prev,
                                                            competitors: {
                                                                urls: newUrls,
                                                                keyPoints: newKeyPoints
                                                            }
                                                        };
                                                    });
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="text-blue-600 hover:text-blue-800"
                                        onClick={() => setSeoData(prev => ({
                                            ...prev,
                                            competitors: {
                                                ...prev.competitors,
                                                urls: [...prev.competitors.urls, '']
                                            }
                                        }))}
                                    >
                                        + Add Competitor
                                    </button>
                                </div>
                            </div>

                            {/* Keywords from CSV Preview */}
                            {seoData.keywords.csvData.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Imported Keywords</h3>
                                    <div className="max-h-60 overflow-y-auto border rounded p-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-2">Keyword</th>
                                                <th className="text-left p-2">Volume</th>
                                                <th className="text-left p-2">Difficulty</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {seoData.keywords.csvData.map((row: any, index: number) => (
                                                <tr key={index} className="border-b">
                                                    <td className="p-2">{row.Keyword}</td>
                                                    <td className="p-2">{row.Volume}</td>
                                                    <td className="p-2">{row.Difficulty}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 6:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">Competitor HTML Files</h2>
                        <Alert>
                            <AlertDescription>
                                Upload HTML files of competitor pages to help Claude analyze their content structure and approach
                            </AlertDescription>
                        </Alert>

                        {seoData.competitors.urls.map((url, index) => (
                            <div key={index} className="space-y-2">
                                <p className="font-medium">{url}</p>
                                <div
                                    className="border-2 border-dashed rounded-lg p-4"
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (e) => {
                                                const content = e.target?.result as string;
                                                setCompetitorPages(prev => ({
                                                    ...prev,
                                                    [url]: content
                                                }));
                                            };
                                            reader.readAsText(file);
                                        }
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <input
                                        type="file"
                                        accept=".html"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (e) => {
                                                    const content = e.target?.result as string;
                                                    setCompetitorPages(prev => ({
                                                        ...prev,
                                                        [url]: content
                                                    }));
                                                };
                                                reader.readAsText(file);
                                            }
                                        }}
                                        className="hidden"
                                        id={`html-upload-${index}`}
                                    />
                                    <label htmlFor={`html-upload-${index}`} className="cursor-pointer">
                                        <div className="text-center">
                                            {competitorPages[url] ? (
                                                <p className="text-green-600">✓ HTML file uploaded</p>
                                            ) : (
                                                <p>Drop HTML file or click to upload</p>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 7:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold">Generated Prompt</h2>
                        <Alert>
                            <AlertDescription>
                                Review and edit the generated prompt before sending to Claude
                            </AlertDescription>
                        </Alert>
                        <textarea
                            className="w-full p-4 border rounded min-h-[400px] font-mono text-sm"
                            value={finalPrompt}
                            onChange={(e) => setFinalPrompt(e.target.value)}
                        />
                        {addedLinks.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold">Added Links:</h3>
                                <ul className="list-disc pl-5">
                                    {addedLinks.map((link, index) => (
                                        <li key={index}>
                                            {link.original} → {link.url}
                                            <br />
                                            <span className="text-sm text-gray-500">{link.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button
                            className={`w-full py-3 rounded-lg ${
                                isGenerating
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            } text-white`}
                            disabled={isGenerating || !apiKey}
                            onClick={async () => {
                                try {
                                    setIsGenerating(true);
                                    setError(null);
                                    const content = await sendToClaude(apiKey, finalPrompt);
                                    setGeneratedContent(content);

                                    // Create a download link for the content
                                    const blob = new Blob([content], { type: 'text/markdown' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${seoData.keywords.mainKeyword.slice(0, 30)}.md`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                } catch (error) {
                                    setError(error instanceof Error ? error.message : 'Failed to generate content');
                                } finally {
                                    setIsGenerating(false);
                                }
                            }}
                        >
                            {isGenerating ? 'Generating...' : 'Generate Content'}
                        </button>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                                {error}
                            </div>
                        )}

                        {generatedContent && !error && (
                            <div className="mt-4 space-y-4">
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
                                    Content generated successfully! The file has been downloaded automatically.
                                </div>
                                <div className="p-4 border rounded-lg bg-gray-50">
                                    <h3 className="font-semibold mb-2">Preview:</h3>
                                    <div className="max-h-96 overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm">
          {generatedContent.slice(0, 500)}...
        </pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <div className="flex justify-between">
                    {[
                        { step: 1, title: 'API Setup' },
                        { step: 2, title: 'Project Config' },
                        { step: 3, title: 'Blog Data' },
                        { step: 4, title: 'Sitemaps' },
                        { step: 5, title: 'SEO Data' },
                        { step: 6, title: 'Competitor HTML' },
                        { step: 7, title: 'Generate' }
                    ].map(({ step, title }) => (
                        <div
                            key={step}
                            className={`flex flex-col items-center ${
                                step === currentStep ? 'text-blue-600' :
                                    step < currentStep ? 'text-green-600' : 'text-gray-400'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                step === currentStep ? 'border-blue-600' :
                                    step < currentStep ? 'border-green-600' : 'border-gray-400'
                            }`}>
                                {step < currentStep ? '✓' : step}
                            </div>
                            <div className="text-sm mt-2">{title}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
                {renderStepContent()}
            </div>

            <div className="mt-6 flex justify-between">
                <button
                    className={`px-6 py-2 rounded-lg ${
                        currentStep === 1 ? 'bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
                    disabled={currentStep === 1}
                >
                    Previous
                </button>
                <button
                    className={`px-6 py-2 rounded-lg ${
                        currentStep === 7 ? 'bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    onClick={() => {
                        if (currentStep < 7) {
                            setCurrentStep(currentStep + 1);
                            if (currentStep === 6) {
                                generatePrompt({
                                    keywords: seoData.keywords.csvData,
                                    blogData: seoData.blogData,
                                    competitorPages: competitorPages,
                                    sitemaps: sitemaps // This comes from your sitemap state
                                });
                            }
                        }
                    }}
                    disabled={currentStep === 7}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default ContentGenerator;