# xAI SDK Migration Plan

## Current State

The grok-cli currently uses the **OpenAI-compatible REST API** (`/v1/chat/completions`) via the OpenAI Node.js SDK pointing to `https://api.x.ai/v1`.

This approach:
- ✅ Works well for function tools (`type: "function"`)
- ❌ Does NOT support built-in search tools (`web_search`, `x_search`, `live_search`)
- ❌ Does NOT support server-side code execution

## Key Finding: No Official Node.js SDK

**xAI only provides an official Python SDK** (`xai-sdk` on PyPI). There is no official Node.js/TypeScript SDK.

| SDK | Status | Protocol |
|-----|--------|----------|
| Python (`xai-sdk`) | Official, v1.6.0 | gRPC |
| Node.js/TypeScript | None official | N/A |
| REST API | OpenAI-compatible | HTTP/REST |

---

## Options Analysis

### Option 1: Stay with REST API (Current Approach)

**Description:** Continue using the OpenAI SDK with xAI's REST endpoint. Implement web search as a custom function tool using a third-party API.

**Pros:**
- ✅ No migration required
- ✅ Stable, well-tested OpenAI SDK
- ✅ TypeScript support out of the box
- ✅ Simple architecture
- ✅ Works in all Node.js environments (serverless, edge, etc.)
- ✅ Large ecosystem of OpenAI-compatible tools

**Cons:**
- ❌ No access to xAI's built-in search (must use third-party like Tavily, SerpAPI)
- ❌ No server-side code execution
- ❌ Additional API costs for third-party search
- ❌ Search results may differ from xAI's native X/web search

**Implementation effort:** Low (add third-party search tool)

---

### Option 2: Python Subprocess Bridge

**Description:** Call the official Python xAI SDK via subprocess for operations that need built-in tools (search, code execution), while keeping REST API for regular chat.

**Pros:**
- ✅ Access to ALL xAI features (web_search, x_search, code_execution)
- ✅ Uses official, supported SDK
- ✅ Can selectively use Python only when needed
- ✅ Keeps TypeScript for main codebase

**Cons:**
- ❌ Requires Python 3.10+ installed on user's system
- ❌ Subprocess overhead (latency, process spawning)
- ❌ Complex error handling across process boundaries
- ❌ Streaming becomes very complicated
- ❌ Deployment complexity (must ship Python scripts)
- ❌ Two languages to maintain

**Implementation effort:** High

---

### Option 3: Build Custom Node.js gRPC Client

**Description:** Reverse-engineer the Python SDK's gRPC protocol and build a native TypeScript client.

**Pros:**
- ✅ Native TypeScript/Node.js
- ✅ Full access to xAI features (if protocol is stable)
- ✅ No Python dependency

**Cons:**
- ❌ gRPC protocol is undocumented and may change
- ❌ Significant development effort
- ❌ Maintenance burden (must track SDK changes)
- ❌ Risk of breaking when xAI updates their protocol
- ❌ No official support

**Implementation effort:** Very High (and risky)

---

### Option 4: Hybrid Approach (Recommended)

**Description:** Use REST API as primary interface, with optional Python bridge for advanced features when available.

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                     grok-cli                            │
├─────────────────────────────────────────────────────────┤
│  Primary: OpenAI SDK → REST API (/v1/chat/completions)  │
│  - All function tools                                   │
│  - Streaming                                            │
│  - Main chat functionality                              │
├─────────────────────────────────────────────────────────┤
│  Optional: Python Bridge (if Python 3.10+ available)    │
│  - web_search (xAI native)                              │
│  - x_search (xAI native)                                │
│  - code_execution (xAI native)                          │
├─────────────────────────────────────────────────────────┤
│  Fallback: Third-party search API                       │
│  - Tavily / SerpAPI / Brave Search                      │
│  - Used when Python not available                       │
└─────────────────────────────────────────────────────────┘
```

**Pros:**
- ✅ Works everywhere (graceful degradation)
- ✅ Best features when Python available
- ✅ Stable REST API for core functionality
- ✅ User choice: install Python for advanced features or use fallback
- ✅ Future-proof: can swap in official Node.js SDK if xAI releases one

**Cons:**
- ❌ More complex codebase
- ❌ Two code paths to test
- ❌ Python bridge still has subprocess overhead

**Implementation effort:** Medium

---

## Recommendation

**Start with Option 1 (REST API only)**, then consider **Option 4 (Hybrid)** if users request native xAI search.

### Rationale:

1. **No official Node.js SDK exists** - Building on unofficial/custom solutions is risky

2. **Third-party search is good enough** - Services like Tavily provide excellent web search at reasonable cost

3. **xAI may release a Node.js SDK** - Better to wait than build fragile bridges

4. **Core functionality works** - Function tools, streaming, and chat all work perfectly via REST

### Immediate Action Plan:

1. **Phase 1: Add third-party web search tool** (1-2 days)
   - Implement `web_search` as a function tool using Tavily or similar
   - User provides their own API key
   - Works reliably without Python dependency

2. **Phase 2: Monitor xAI SDK releases** (ongoing)
   - Watch https://github.com/xai-org for Node.js SDK announcement
   - Track REST API updates for built-in tool support

3. **Phase 3: (Optional) Python bridge** (if demand exists)
   - Only if users specifically need xAI's native X search
   - Implement as optional feature with clear documentation

---

## Third-Party Search Options

| Service | Pricing | Quality | X/Twitter |
|---------|---------|---------|-----------|
| [Tavily](https://tavily.com) | Free tier + paid | Excellent | No |
| [SerpAPI](https://serpapi.com) | $50/mo+ | Excellent | No |
| [Brave Search](https://brave.com/search/api/) | Free tier + paid | Good | No |
| [Exa](https://exa.ai) | Free tier + paid | Good | No |

**Note:** None of these provide X/Twitter search. For X search specifically, the Python bridge would be required.

---

## Decision Matrix

| Criteria | Option 1 (REST) | Option 2 (Python) | Option 3 (gRPC) | Option 4 (Hybrid) |
|----------|-----------------|-------------------|-----------------|-------------------|
| Implementation effort | Low | High | Very High | Medium |
| Maintenance burden | Low | Medium | High | Medium |
| Feature completeness | Medium | High | High | High |
| Reliability | High | Medium | Low | High |
| User experience | Good | Complex | Good | Good |
| Future-proof | High | Medium | Low | High |

---

## Conclusion

The lack of an official Node.js xAI SDK is the key constraint. Until xAI provides one:

1. **Use REST API** for all core functionality
2. **Add Tavily/similar** for web search capability
3. **Document the limitation** regarding native X search
4. **Revisit when/if** xAI releases a Node.js SDK

This approach minimizes risk while providing a good user experience.
