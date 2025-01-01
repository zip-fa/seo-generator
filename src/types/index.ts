// src/types/index.ts
export interface ProjectData {
    general: {
        language: string;
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

export interface SeoData {
    keywords: {
        mainKeyword: string;
        searchVolume: number;
        relatedKeywords: string[];
    };
    competitors: {
        url: string;
        keyPoints: string;
    }[];
    blogData: {
        title: string;
        url: string;
        tags: string[];
    }[];
}