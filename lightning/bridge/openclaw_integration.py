#!/usr/bin/env python3
"""
Safe Agent Lightning Integration for OpenClaw

This module provides a wrapper for OpenClaw's tool execution that adds
Agent Lightning tracing with zero breaking changes.

Features:
- Feature flag controlled (ENABLE_AGENT_LIGHTNING env var)
- Graceful degradation (agent works if Lightning fails)
- Minimal overhead (~13µs per span)
- Easy to disable/remove

Usage:
    from openclaw_integration import OpenClawLightningTracer
    
    tracer = OpenClawLightningTracer()
    
    # In your tool executor:
    with tracer.trace_tool("web_search", query="test"):
        result = execute_web_search("test")
    
    # At end of task:
    tracer.emit_task_reward(success=True, tokens_used=500)
"""

import os
import asyncio
import time
from typing import Optional, Dict, Any, Callable
from contextlib import contextmanager
from pathlib import Path
import logging

# Safe imports with fallback
try:
    from agentlightning import OtelTracer, emit_reward
    from agentlightning.store import InMemoryLightningStore
    AGENT_LIGHTNING_AVAILABLE = True
except ImportError:
    AGENT_LIGHTNING_AVAILABLE = False
    logging.warning("Agent Lightning not available - tracing disabled")


class OpenClawLightningTracer:
    """
    Safe wrapper for Agent Lightning integration into OpenClaw.
    
    If Lightning is disabled or unavailable, all methods become no-ops
    so the agent continues working normally.
    """
    
    def __init__(self):
        """Initialize tracer with safety checks."""
        self.enabled = self._check_enabled()
        self.tracer = None
        self.store = None
        self.current_rollout = None
        self.current_tracer_ctx = None
        self.session_start_time = None
        self.tool_call_count = 0
        self.logger = logging.getLogger(__name__)
        
        if self.enabled:
            try:
                self.tracer = OtelTracer()
                self.store = InMemoryLightningStore()
                self.logger.info("✓ Agent Lightning tracing enabled")
            except Exception as e:
                self.logger.error(f"Failed to initialize Agent Lightning: {e}")
                self.enabled = False
    
    def _check_enabled(self) -> bool:
        """Check if Agent Lightning should be enabled."""
        # Feature flag
        if not os.getenv("ENABLE_AGENT_LIGHTNING", "false").lower() == "true":
            return False
        
        # Library available?
        if not AGENT_LIGHTNING_AVAILABLE:
            self.logger.warning("ENABLE_AGENT_LIGHTNING=true but library not available")
            return False
        
        return True
    
    async def start_session(self, user_message: str, session_metadata: Optional[Dict[str, Any]] = None):
        """
        Start a new session (rollout) for tracking.
        
        Call this at the start of handling a user message.
        Safe to call even if tracing is disabled - becomes no-op.
        """
        if not self.enabled:
            return
        
        try:
            self.session_start_time = time.time()
            self.tool_call_count = 0
            
            input_data = {
                "user_message": user_message,
                "timestamp": self.session_start_time
            }
            
            if session_metadata:
                input_data.update(session_metadata)
            
            self.current_rollout = await self.store.start_rollout(input=input_data)
            
            # Start trace context (wrapped in try-catch for safety)
            try:
                self.tracer.lifespan(self.store).__enter__()
                self.current_tracer_ctx = await self.tracer.trace_context(
                    f"openclaw-session-{int(self.session_start_time)}",
                    store=self.store,
                    rollout_id=self.current_rollout.rollout_id,
                    attempt_id=self.current_rollout.attempt.attempt_id
                ).__aenter__()
            except Exception as ctx_error:
                self.logger.error(f"Failed to start trace context: {ctx_error}")
                self.current_tracer_ctx = None
            
            self.logger.debug(f"Started session tracking: {self.current_rollout.rollout_id}")
        
        except Exception as e:
            self.logger.error(f"Failed to start session: {e}")
            self.enabled = False  # Disable for this session to prevent cascading failures
    
    @contextmanager
    def trace_tool(self, tool_name: str, **kwargs):
        """
        Context manager to trace a tool call.
        
        Usage:
            with tracer.trace_tool("web_search", query="test"):
                result = execute_web_search("test")
        
        Safe to use even if tracing disabled - becomes pass-through.
        """
        if not self.enabled or not self.current_tracer_ctx:
            yield  # No-op, just execute the wrapped code
            return
        
        try:
            self.tool_call_count += 1
            
            with self.current_tracer_ctx.start_as_current_span(f"tool-{tool_name}") as span:
                # Add tool metadata
                span.set_attribute("tool.name", tool_name)
                span.set_attribute("tool.call_number", self.tool_call_count)
                
                # Add all kwargs as attributes
                for key, value in kwargs.items():
                    span.set_attribute(f"tool.{key}", str(value)[:200])  # Truncate long values
                
                yield
        
        except Exception as e:
            self.logger.error(f"Error tracing tool {tool_name}: {e}")
            yield  # Still execute the wrapped code even if tracing fails
    
    def emit_task_reward(
        self,
        success: bool,
        tokens_used: Optional[int] = None,
        expected_tokens: Optional[int] = None,
        duration_seconds: Optional[float] = None,
        user_rating: Optional[int] = None
    ):
        """
        Emit a reward for the completed task.
        
        Args:
            success: Whether task completed successfully
            tokens_used: Actual tokens used (optional)
            expected_tokens: Expected token count (optional)
            duration_seconds: Task duration (optional, auto-calculated if not provided)
            user_rating: User feedback 1-5 (optional)
        
        Reward calculation:
            Base: +1.0 for success, -0.5 for failure
            Token efficiency: +0.1 if under expected tokens
            Time efficiency: +0.1 if under 30 seconds
            User feedback: (rating - 3) * 0.2 = -0.4 to +0.4
        
        Safe to call even if tracing disabled - becomes no-op.
        """
        if not self.enabled or not self.current_tracer_ctx:
            return
        
        try:
            # Base reward
            reward = 1.0 if success else -0.5
            
            # Token efficiency bonus
            if tokens_used and expected_tokens and tokens_used < expected_tokens:
                reward += 0.1
                self.logger.debug(f"Token efficiency bonus: {tokens_used}/{expected_tokens}")
            
            # Time efficiency bonus
            if duration_seconds is None and self.session_start_time:
                duration_seconds = time.time() - self.session_start_time
            
            if duration_seconds and duration_seconds < 30.0:
                reward += 0.1
                self.logger.debug(f"Time efficiency bonus: {duration_seconds:.1f}s")
            
            # User feedback
            if user_rating is not None:
                feedback_bonus = (user_rating - 3) * 0.2
                reward += feedback_bonus
                self.logger.debug(f"User feedback bonus: {feedback_bonus:+.1f}")
            
            # Emit the reward
            emit_reward(reward)
            
            self.logger.info(
                f"Task reward: {reward:+.2f} "
                f"(success={success}, tools={self.tool_call_count}, "
                f"duration={duration_seconds:.1f}s)"
            )
        
        except Exception as e:
            self.logger.error(f"Failed to emit reward: {e}")
    
    async def end_session(self):
        """
        End the current session and clean up.
        
        Call this after the task completes.
        Safe to call even if tracing disabled - becomes no-op.
        """
        if not self.enabled:
            return
        
        try:
            if self.current_tracer_ctx:
                await self.current_tracer_ctx.__aexit__(None, None, None)
                self.current_tracer_ctx = None
            
            # No need to explicitly exit tracer.lifespan - it's handled by context
            
            if self.session_start_time:
                duration = time.time() - self.session_start_time
                self.logger.debug(f"Session ended: {duration:.2f}s, {self.tool_call_count} tools")
            
            self.current_rollout = None
            self.session_start_time = None
            self.tool_call_count = 0
        
        except Exception as e:
            self.logger.error(f"Failed to end session: {e}")
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get current session statistics."""
        if not self.enabled or not self.session_start_time:
            return {}
        
        return {
            "enabled": self.enabled,
            "rollout_id": self.current_rollout.rollout_id if self.current_rollout else None,
            "duration_seconds": time.time() - self.session_start_time,
            "tool_call_count": self.tool_call_count
        }


# Global singleton instance (lazy initialization)
_global_tracer: Optional[OpenClawLightningTracer] = None


def get_tracer() -> OpenClawLightningTracer:
    """
    Get or create the global tracer instance.
    
    This ensures only one tracer exists per process.
    """
    global _global_tracer
    if _global_tracer is None:
        _global_tracer = OpenClawLightningTracer()
    return _global_tracer


# ============================================================================
# Integration Example (for documentation)
# ============================================================================

async def example_integration():
    """
    Example showing how to integrate Agent Lightning into OpenClaw.
    
    This would go into OpenClaw's tool executor.
    """
    tracer = get_tracer()
    
    # Start session when handling user message
    await tracer.start_session(
        user_message="Research Agent Lightning and write summary",
        session_metadata={"channel": "telegram", "user_id": "12345"}
    )
    
    try:
        # Trace tool calls
        with tracer.trace_tool("web_search", query="Agent Lightning"):
            # ... actual web search logic ...
            pass
        
        with tracer.trace_tool("read", path="README.md"):
            # ... actual read logic ...
            pass
        
        with tracer.trace_tool("write", path="summary.md", bytes=2500):
            # ... actual write logic ...
            pass
        
        # Task completed successfully
        success = True
        tracer.emit_task_reward(
            success=success,
            tokens_used=450,
            expected_tokens=500
        )
    
    except Exception as e:
        # Task failed
        tracer.emit_task_reward(success=False)
        raise
    
    finally:
        # Always clean up
        await tracer.end_session()


if __name__ == "__main__":
    # Test the integration
    print("OpenClaw Agent Lightning Integration - Safe Mode")
    print("=" * 60)
    
    tracer = get_tracer()
    print(f"Status: {'✓ Enabled' if tracer.enabled else '✗ Disabled'}")
    print(f"Reason: {'Feature flag' if not tracer.enabled else 'Ready'}")
    
    if tracer.enabled:
        print("\nTo disable: export ENABLE_AGENT_LIGHTNING=false")
    else:
        print("\nTo enable: export ENABLE_AGENT_LIGHTNING=true")
    
    print("\nSafety features:")
    print("  ✓ Feature flag controlled")
    print("  ✓ Graceful degradation")
    print("  ✓ No breaking changes")
    print("  ✓ Easy rollback")
