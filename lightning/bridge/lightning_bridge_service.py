#!/usr/bin/env python3
"""
Agent Lightning Bridge Service

HTTP service that OpenClaw (Node.js) can call to track tool usage with Agent Lightning (Python).

Architecture:
    OpenClaw (Node.js) → HTTP POST → Bridge Service (Python) → Agent Lightning

Endpoints:
    POST /session/start - Start a new session
    POST /tool/trace - Record a tool call
    POST /session/reward - Emit reward for completed session
    POST /session/end - End session
    GET /health - Health check
    GET /stats - Get current statistics

Usage:
    # Start the service
    python3 lightning_bridge_service.py
    
    # From OpenClaw (curl example):
    curl -X POST http://localhost:8765/session/start \\
         -H "Content-Type: application/json" \\
         -d '{"message": "test"}'
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

from aiohttp import web
from openclaw_integration import OpenClawLightningTracer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global tracer instance
tracer: Optional[OpenClawLightningTracer] = None
current_sessions: Dict[str, Any] = {}


async def handle_session_start(request):
    """Start a new Lightning session."""
    global tracer, current_sessions
    
    try:
        data = await request.json()
        user_message = data.get('message', '')
        session_id = data.get('session_id', f"session-{datetime.now().timestamp()}")
        metadata = data.get('metadata', {})
        
        # Initialize tracer if needed
        if tracer is None:
            tracer = OpenClawLightningTracer()
        
        # Start session
        await tracer.start_session(
            user_message=user_message,
            session_metadata={**metadata, 'bridge_session_id': session_id}
        )
        
        # Track session
        current_sessions[session_id] = {
            'started_at': datetime.now().isoformat(),
            'message': user_message,
            'tool_count': 0
        }
        
        logger.info(f"Started session {session_id}")
        
        return web.json_response({
            'success': True,
            'session_id': session_id,
            'enabled': tracer.enabled
        })
    
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_tool_trace(request):
    """Record a tool call."""
    global tracer, current_sessions
    
    try:
        data = await request.json()
        session_id = data.get('session_id')
        tool_name = data.get('tool_name')
        tool_params = data.get('params', {})
        
        if tracer is None or not tracer.enabled:
            return web.json_response({
                'success': True,
                'traced': False,
                'reason': 'tracing disabled'
            })
        
        # Track tool call (synchronous wrapper since OpenClaw can't wait)
        # Note: This is a simplified version - real integration would use proper async
        logger.info(f"Tool trace: {tool_name} (session: {session_id})")
        
        if session_id in current_sessions:
            current_sessions[session_id]['tool_count'] += 1
        
        return web.json_response({
            'success': True,
            'traced': True,
            'tool_name': tool_name
        })
    
    except Exception as e:
        logger.error(f"Error tracing tool: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_session_reward(request):
    """Emit reward for completed session."""
    global tracer
    
    try:
        data = await request.json()
        session_id = data.get('session_id')
        success = data.get('success', False)
        tokens_used = data.get('tokens_used')
        expected_tokens = data.get('expected_tokens')
        duration = data.get('duration')
        
        if tracer is None or not tracer.enabled:
            return web.json_response({
                'success': True,
                'rewarded': False,
                'reason': 'tracing disabled'
            })
        
        tracer.emit_task_reward(
            success=success,
            tokens_used=tokens_used,
            expected_tokens=expected_tokens,
            duration_seconds=duration
        )
        
        logger.info(f"Reward emitted for session {session_id}: success={success}")
        
        return web.json_response({
            'success': True,
            'rewarded': True
        })
    
    except Exception as e:
        logger.error(f"Error emitting reward: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_session_end(request):
    """End a Lightning session."""
    global tracer, current_sessions
    
    try:
        data = await request.json()
        session_id = data.get('session_id')
        
        if tracer is None or not tracer.enabled:
            if session_id in current_sessions:
                del current_sessions[session_id]
            return web.json_response({
                'success': True,
                'ended': False,
                'reason': 'tracing disabled'
            })
        
        await tracer.end_session()
        
        if session_id in current_sessions:
            del current_sessions[session_id]
        
        logger.info(f"Ended session {session_id}")
        
        return web.json_response({
            'success': True,
            'ended': True
        })
    
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_health(request):
    """Health check endpoint."""
    global tracer
    
    enabled = tracer.enabled if tracer else False
    
    return web.json_response({
        'status': 'healthy',
        'service': 'agent-lightning-bridge',
        'tracing_enabled': enabled,
        'active_sessions': len(current_sessions)
    })


async def handle_stats(request):
    """Get current statistics."""
    global tracer, current_sessions
    
    stats = {
        'enabled': tracer.enabled if tracer else False,
        'active_sessions': len(current_sessions),
        'sessions': current_sessions
    }
    
    if tracer and tracer.enabled:
        stats['session_stats'] = tracer.get_session_stats()
    
    return web.json_response(stats)


async def init_app():
    """Initialize the web application."""
    app = web.Application()
    
    # Routes
    app.router.add_post('/session/start', handle_session_start)
    app.router.add_post('/tool/trace', handle_tool_trace)
    app.router.add_post('/session/reward', handle_session_reward)
    app.router.add_post('/session/end', handle_session_end)
    app.router.add_get('/health', handle_health)
    app.router.add_get('/stats', handle_stats)
    
    return app


def main():
    """Run the bridge service."""
    port = int(os.getenv('LIGHTNING_BRIDGE_PORT', '8765'))
    
    print("=" * 60)
    print("Agent Lightning Bridge Service")
    print("=" * 60)
    print(f"Port: {port}")
    print(f"Feature flag: ENABLE_AGENT_LIGHTNING={os.getenv('ENABLE_AGENT_LIGHTNING', 'false')}")
    print(f"Health check: http://localhost:{port}/health")
    print(f"Stats: http://localhost:{port}/stats")
    print("=" * 60)
    print()
    
    # Create and run app
    app = asyncio.run(init_app())
    web.run_app(app, host='localhost', port=port)


if __name__ == '__main__':
    main()
