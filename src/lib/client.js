/**
 * memories.ai API client
 * Base URL: https://api.memories.ai
 * Auth: Authorization: <API_KEY>
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

const BASE_URL = 'https://api.memories.ai';
const VISION_URL = 'https://security.memories.ai';

export class MemoriesClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = BASE_URL;
    this.visionUrl = VISION_URL;
  }

  async request(path, { method = 'POST', body, query, form, base } = {}) {
    const url = new URL(path, base || this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      }
    }

    const headers = { Authorization: this.apiKey };
    let fetchBody;

    if (form) {
      // Use native FormData (Node 18+) for Spring-compatible multipart uploads
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) {
        if (v !== undefined && v !== null) {
          if (typeof v === 'object' && v.path) {
            const fileBuffer = readFileSync(v.path);
            const blob = new Blob([fileBuffer], { type: v.mime || 'application/octet-stream' });
            fd.append(k, blob, basename(v.path));
          } else if (Array.isArray(v)) {
            v.forEach(item => fd.append(k, item));
          } else {
            fd.append(k, String(v));
          }
        }
      }
      // Let fetch set Content-Type with boundary automatically
      fetchBody = fd;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), { method, headers, body: fetchBody });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      return { stream: res.body, status: res.status };
    }

    const data = await res.json();
    if (!res.ok || (data.code !== '0000' && data.code !== 0)) {
      const msg = data.msg || data.detail || JSON.stringify(data);
      const code = data.code || res.status;
      // Provide human-readable hints for known error codes
      const hints = {
        '0402': ' (insufficient credits - check your plan at api-platform.memories.ai)',
        '0429': ' (rate limited - wait and retry)',
        '0001': '',
      };
      throw new Error(`API Error [${code}]: ${msg}${hints[code] || ''}`);
    }
    return data;
  }

  // ─── Memory Operations ───────────────────────────────────────────────

  async addMemory({ uniqueId, memories, tags, latitude, longitude, memoriesAt }) {
    return this.request('/serve/api/v1/memories/add', {
      body: {
        unique_id: uniqueId,
        memories,
        memories_at: memoriesAt || new Date().toISOString(),
        ...(tags && { tags }),
        ...(latitude && { latitude }),
        ...(longitude && { longitude }),
      },
    });
  }

  async listMemories({ uniqueId, page = 1, pageSize = 20, filters } = {}) {
    return this.request('/serve/api/v1/memories', {
      body: {
        unique_id: uniqueId || 'default',
        page,
        page_size: pageSize,
        ...(filters && { filters }),
      },
    });
  }

  async searchMemories({ uniqueId, query, page = 1, pageSize = 20, filters } = {}) {
    return this.request('/serve/api/v1/memories/search', {
      body: {
        unique_id: uniqueId || 'default',
        query,
        page,
        page_size: pageSize,
        ...(filters && { filters }),
      },
    });
  }

  // ─── Video Operations ────────────────────────────────────────────────

  async uploadVideoFromUrl({ url, uniqueId, callback, tags, retainOriginal = false, prompt }) {
    return this.request('/serve/api/v1/upload_url', {
      form: {
        url,
        ...(uniqueId && { unique_id: uniqueId }),
        ...(callback && { callback }),
        ...(tags && { tags }),
        retain_original_video: String(retainOriginal),
        ...(prompt && { video_transcription_prompt: prompt }),
      },
    });
  }

  async uploadVideoFromFile({ filePath, uniqueId, callback, tags, retainOriginal = false, prompt }) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeMap = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm', mkv: 'video/x-matroska' };
    return this.request('/serve/api/v1/upload', {
      form: {
        file: { path: filePath, mime: mimeMap[ext] || 'video/mp4' },
        ...(uniqueId && { unique_id: uniqueId }),
        ...(callback && { callback }),
        ...(tags && { tags }),
        retain_original_video: String(retainOriginal),
        ...(prompt && { video_transcription_prompt: prompt }),
      },
    });
  }

  async listVideos({ uniqueId, page = 1, size = 20, status, videoName, videoNo } = {}) {
    return this.request('/serve/api/v1/list_videos', {
      body: {
        page,
        size,
        ...(uniqueId && { unique_id: uniqueId }),
        ...(status && { status }),
        ...(videoName && { video_name: videoName }),
        ...(videoNo && { video_no: videoNo }),
      },
    });
  }

  async deleteVideos(videoNos, uniqueId) {
    return this.request('/serve/api/v1/delete_videos', {
      body: videoNos,
      query: uniqueId ? { unique_id: uniqueId } : undefined,
    });
  }

  async getTaskStatus(taskId, uniqueId) {
    return this.request('/serve/api/v1/get_video_ids_by_task_id', {
      method: 'GET',
      query: { task_id: taskId, ...(uniqueId && { unique_id: uniqueId }) },
    });
  }

  async downloadVideo(videoNo, uniqueId) {
    return this.request('/serve/api/v1/download', {
      body: { video_no: videoNo, ...(uniqueId && { unique_id: uniqueId }) },
    });
  }

  async downloadVideoRaw(videoNo, uniqueId) {
    const url = new URL('/serve/api/v1/download', this.baseUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_no: videoNo, ...(uniqueId && { unique_id: uniqueId }) }),
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    // API returns JSON error for private videos (VI-), binary data for public (PI-)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      throw new Error(data.msg || 'Download not available for this video');
    }
    return res;
  }

  // ─── Search Operations ───────────────────────────────────────────────

  async searchPrivate({ query, searchType = 'BY_VIDEO', uniqueId, topK = 10, filteringLevel, tag, videoNos }) {
    return this.request('/serve/api/v1/search', {
      body: {
        search_param: query,
        search_type: searchType,
        ...(uniqueId && { unique_id: uniqueId }),
        top_k: topK,
        ...(filteringLevel && { filtering_level: filteringLevel }),
        ...(tag && { tag }),
        ...(videoNos && { video_nos: videoNos }),
      },
    });
  }

  async searchPublic({ query, searchType = 'BY_VIDEO', platform = 'YOUTUBE', topK = 10, filteringLevel }) {
    return this.request('/serve/api/v1/search_public', {
      body: {
        search_param: query,
        search_type: searchType,
        type: platform,
        top_k: topK,
        ...(filteringLevel && { filtering_level: filteringLevel }),
      },
    });
  }

  async searchAudio({ videoNo, query, uniqueId }) {
    return this.request('/serve/api/v1/search_audio_transcripts', {
      method: 'GET',
      query: {
        video_no: videoNo,
        query,
        ...(uniqueId && { unique_id: uniqueId }),
      },
    });
  }

  // ─── Chat Operations ─────────────────────────────────────────────────

  async chatVideo({ videoNos, prompt, sessionId, uniqueId }) {
    const body = {
      video_nos: videoNos,
      prompt,
      unique_id: uniqueId || 'default',
    };
    // session_id must be a number (Long) or omitted; string values cause parse errors
    if (sessionId && !isNaN(Number(sessionId))) body.session_id = Number(sessionId);
    return this.request('/serve/api/v1/chat', { body });
  }

  async chatVideoStream({ videoNos, prompt, sessionId, uniqueId }) {
    const body = {
      video_nos: videoNos,
      prompt,
      unique_id: uniqueId || 'default',
    };
    if (sessionId && !isNaN(Number(sessionId))) body.session_id = Number(sessionId);
    const url = new URL('/serve/api/v1/chat_stream', this.baseUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });
    return res.body;
  }

  async chatPersonal({ prompt, sessionId, uniqueId }) {
    const body = {
      prompt,
      unique_id: uniqueId || 'default',
    };
    if (sessionId && !isNaN(Number(sessionId))) body.session_id = Number(sessionId);
    return this.request('/serve/api/v1/chat_personal', { body });
  }

  async chatPersonalStream({ prompt, sessionId, uniqueId }) {
    const body = {
      prompt,
      unique_id: uniqueId || 'default',
    };
    if (sessionId && !isNaN(Number(sessionId))) body.session_id = Number(sessionId);
    const url = new URL('/serve/api/v1/chat_personal_stream', this.baseUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });
    return res.body;
  }

  // ─── Transcription ───────────────────────────────────────────────────

  async getVideoTranscription(videoNo, uniqueId) {
    return this.request('/serve/api/v1/get_video_transcription', {
      method: 'GET',
      query: { video_no: videoNo, ...(uniqueId && { unique_id: uniqueId }) },
    });
  }

  async getAudioTranscription(videoNo, uniqueId) {
    return this.request('/serve/api/v1/get_audio_transcription', {
      method: 'GET',
      query: { video_no: videoNo, ...(uniqueId && { unique_id: uniqueId }) },
    });
  }

  // ─── Vision / Caption ────────────────────────────────────────────────

  async captionVideo({ videoUrl, userPrompt, systemPrompt, thinking = false }) {
    return this.request('/v1/understand/upload', {
      base: this.visionUrl,
      body: {
        video_url: videoUrl,
        user_prompt: userPrompt,
        system_prompt: systemPrompt || 'You are a helpful video analyst.',
        thinking,
      },
    });
  }

  async captionImage({ imageUrl, userPrompt, systemPrompt }) {
    return this.request('/v1/understand/uploadImg', {
      base: this.visionUrl,
      body: {
        image_url: imageUrl,
        user_prompt: userPrompt,
        system_prompt: systemPrompt || 'You are a helpful image analyst.',
      },
    });
  }

  // ─── Social Media Scraping ───────────────────────────────────────────

  async scrapeByUrl({ url, uniqueId, tags }) {
    return this.request('/serve/api/v1/scraper_url', {
      form: {
        url,
        ...(uniqueId && { unique_id: uniqueId }),
        ...(tags && { tags }),
      },
    });
  }

  async scrapeByHashtag({ hashtag, platform = 'TIKTOK', count = 10, uniqueId, tags }) {
    return this.request('/serve/api/v1/scraper_tag', {
      form: {
        tag: hashtag,
        type: platform,
        count: String(count),
        ...(uniqueId && { unique_id: uniqueId }),
        ...(tags && { tags }),
      },
    });
  }

  async scrapeByCreator({ creatorUrl, uniqueId, count = 10 }) {
    return this.request('/serve/api/v1/scraper', {
      form: {
        url: creatorUrl,
        ...(uniqueId && { unique_id: uniqueId }),
        count: String(count),
      },
    });
  }
}
