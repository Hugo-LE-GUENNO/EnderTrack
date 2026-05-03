"""
event_stream.py — Server-Sent Events (SSE) for real-time client sync.
No dependencies — uses Flask native Response with text/event-stream.

Clients connect to GET /api/events (persistent connection).
Server pushes events when state changes, movements happen, etc.
"""

import json
import time
import threading
from queue import Queue, Empty


class EventBus:
    """Thread-safe event broadcaster to all connected SSE clients."""

    def __init__(self):
        self._clients = []  # list of Queue
        self._lock = threading.Lock()

    def subscribe(self):
        q = Queue(maxsize=50)
        with self._lock:
            self._clients.append(q)
        return q

    def unsubscribe(self, q):
        with self._lock:
            if q in self._clients:
                self._clients.remove(q)

    def publish(self, event_type, data=None):
        """Send event to all connected clients."""
        msg = json.dumps({'type': event_type, 'data': data, 'ts': time.time()})
        dead = []
        with self._lock:
            for q in self._clients:
                try:
                    q.put_nowait(msg)
                except Exception:
                    dead.append(q)
            for q in dead:
                self._clients.remove(q)

    @property
    def client_count(self):
        return len(self._clients)


# Global event bus
bus = EventBus()


def register_routes(app):
    from flask import Response, request, jsonify

    @app.route('/api/events')
    def _sse():
        """SSE endpoint — persistent connection, server pushes events."""
        q = bus.subscribe()
        ip = request.remote_addr

        def stream():
            # Send initial ping
            yield f"data: {json.dumps({'type': 'connected', 'data': {'clients': bus.client_count}})}\n\n"
            try:
                while True:
                    try:
                        msg = q.get(timeout=15)
                        yield f"data: {msg}\n\n"
                    except Empty:
                        # Keepalive every 15s
                        yield f": keepalive\n\n"
            except GeneratorExit:
                pass
            finally:
                bus.unsubscribe(q)

        return Response(stream(), mimetype='text/event-stream',
                        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

    @app.route('/api/events/publish', methods=['POST'])
    def _publish():
        """Frontend publishes events that get broadcast to all other clients."""
        data = request.get_json() or {}
        event_type = data.get('type', 'update')
        event_data = data.get('data')
        ip = request.remote_addr
        # Add sender IP so clients can ignore their own events
        if isinstance(event_data, dict):
            event_data['_from'] = ip
        elif event_data is None:
            event_data = {'_from': ip}
        bus.publish(event_type, event_data)
        return jsonify({'success': True, 'clients': bus.client_count})

    @app.route('/api/events/clients')
    def _clients():
        return jsonify({'count': bus.client_count})
