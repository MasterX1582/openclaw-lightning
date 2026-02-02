/**
 * Agent Lightning Client for OpenClaw
 * 
 * TypeScript/Node.js client to communicate with Agent Lightning Bridge Service.
 * 
 * Usage:
 *   import { LightningClient } from './openclaw-client';
 *   
 *   const lightning = new LightningClient();
 *   
 *   // Start session
 *   await lightning.startSession(message);
 *   
 *   // Trace tool calls
 *   await lightning.traceTool('web_search', { query: 'test' });
 *   
 *   // Emit reward
 *   await lightning.emitReward({ success: true, tokensUsed: 500 });
 *   
 *   // End session
 *   await lightning.endSession();
 */

export interface LightningConfig {
  bridgeUrl?: string;
  enabled?: boolean;
  timeout?: number;
}

export interface SessionStartData {
  message: string;
  session_id?: string;
  metadata?: Record<string, any>;
}

export interface ToolTraceData {
  session_id: string;
  tool_name: string;
  params?: Record<string, any>;
}

export interface RewardData {
  session_id: string;
  success: boolean;
  tokens_used?: number;
  expected_tokens?: number;
  duration?: number;
}

export interface SessionStats {
  enabled: boolean;
  active_sessions: number;
  sessions: Record<string, any>;
  session_stats?: Record<string, any>;
}

export class LightningClient {
  private config: Required<LightningConfig>;
  private currentSessionId: string | null = null;
  private sessionStartTime: number | null = null;

  constructor(config: LightningConfig = {}) {
    this.config = {
      bridgeUrl: config.bridgeUrl || process.env.LIGHTNING_BRIDGE_URL || 'http://localhost:8765',
      enabled: config.enabled !== undefined ? config.enabled : true,
      timeout: config.timeout || 5000,
    };
  }

  /**
   * Check if Agent Lightning is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Health check - verify bridge service is running
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const response = await fetch(`${this.config.bridgeUrl}/health`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });
      return response.ok;
    } catch (error) {
      console.error('Lightning health check failed:', error);
      return false;
    }
  }

  /**
   * Get current statistics from bridge service
   */
  async getStats(): Promise<SessionStats | null> {
    if (!this.config.enabled) return null;

    try {
      const response = await fetch(`${this.config.bridgeUrl}/stats`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to get Lightning stats:', error);
      return null;
    }
  }

  /**
   * Start a new session
   */
  async startSession(data: SessionStartData): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const sessionId = data.session_id || `session-${Date.now()}`;
      this.currentSessionId = sessionId;
      this.sessionStartTime = Date.now();

      const response = await fetch(`${this.config.bridgeUrl}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, session_id: sessionId }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        console.error('Failed to start Lightning session:', response.statusText);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error starting Lightning session:', error);
      // Don't fail the agent if Lightning fails
      return false;
    }
  }

  /**
   * Trace a tool call
   */
  async traceTool(toolName: string, params: Record<string, any> = {}): Promise<boolean> {
    if (!this.config.enabled || !this.currentSessionId) return false;

    try {
      const response = await fetch(`${this.config.bridgeUrl}/tool/trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.currentSessionId,
          tool_name: toolName,
          params,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        console.error('Failed to trace tool:', response.statusText);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      // Don't log - this happens frequently and shouldn't spam logs
      return false;
    }
  }

  /**
   * Emit reward for completed task
   */
  async emitReward(data: Omit<RewardData, 'session_id'>): Promise<boolean> {
    if (!this.config.enabled || !this.currentSessionId) return false;

    try {
      // Calculate duration if not provided
      const duration = data.duration || 
        (this.sessionStartTime ? (Date.now() - this.sessionStartTime) / 1000 : undefined);

      const response = await fetch(`${this.config.bridgeUrl}/session/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.currentSessionId,
          success: data.success,
          tokens_used: data.tokens_used,
          expected_tokens: data.expected_tokens,
          duration,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        console.error('Failed to emit reward:', response.statusText);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error emitting reward:', error);
      return false;
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<boolean> {
    if (!this.config.enabled || !this.currentSessionId) return false;

    try {
      const response = await fetch(`${this.config.bridgeUrl}/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.currentSessionId }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      this.currentSessionId = null;
      this.sessionStartTime = null;

      if (!response.ok) {
        console.error('Failed to end Lightning session:', response.statusText);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error ending Lightning session:', error);
      // Still reset state even if request failed
      this.currentSessionId = null;
      this.sessionStartTime = null;
      return false;
    }
  }

  /**
   * Wrapper for executing a function with automatic tool tracing
   */
  async withToolTrace<T>(
    toolName: string, 
    params: Record<string, any>, 
    fn: () => Promise<T>
  ): Promise<T> {
    await this.traceTool(toolName, params);
    return fn();
  }
}

// Singleton instance for convenience
let _globalClient: LightningClient | null = null;

export function getLightningClient(config?: LightningConfig): LightningClient {
  if (!_globalClient) {
    _globalClient = new LightningClient(config);
  }
  return _globalClient;
}

// Export for ES modules and CommonJS
export default LightningClient;
