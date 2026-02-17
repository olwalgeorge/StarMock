// @vitest-environment node

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { openAIFeedbackProvider } from '../services/feedback/providers/openAIProvider.js'

interface StreamEvaluation {
  scores: {
    situation: number
    task: number
    action: number
    result: number
    detail: number
    overall: number
  }
  rating: string
  strengths: string[]
  suggestions: string[]
  analysis: Record<string, unknown>
}

interface StreamEvent {
  chunk: string
  done: boolean
  evaluation?: StreamEvaluation
}

/**
 * Helper: build a fake ReadableStream that emits OpenAI-style SSE chunks.
 * Each string in `chunks` becomes a `data:` line in the SSE stream.
 */
function fakeSSEStream(chunks: string[]) {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

/** Build an OpenAI-style SSE data line for a content delta */
function sseDelta(content: string, model = 'gpt-4o-mini') {
  return `data: ${JSON.stringify({
    model,
    choices: [{ delta: { content } }],
  })}\n\n`
}

const VALID_JSON_EVALUATION = JSON.stringify({
  scores: {
    situation: 75,
    task: 70,
    action: 80,
    result: 82,
    detail: 68,
    overall: 77,
  },
  rating: 'good',
  strengths: ['Clear structure', 'Quantified outcome'],
  suggestions: ['Add timeline context'],
  analysis: { roleFitSummary: 'Solid match for the target role' },
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.OPENAI_API_KEY
})

describe('openAIFeedbackProvider.streamEvaluate', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key-streaming'
  })

  it('throws when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY

    const generator = openAIFeedbackProvider.streamEvaluate({
      responseText: 'Some response',
      question: { questionText: 'Tell me about a challenge' },
      airContext: null,
    })

    await expect(generator.next()).rejects.toThrow('OPENAI_API_KEY')
  })

  it('yields intermediate chunks followed by a final evaluation', async () => {
    // Simulate an SSE stream that delivers the evaluation JSON in 3 chunks
    const part1 = VALID_JSON_EVALUATION.slice(0, 80)
    const part2 = VALID_JSON_EVALUATION.slice(80, 160)
    const part3 = VALID_JSON_EVALUATION.slice(160)

    const stream = fakeSSEStream([
      sseDelta(part1),
      sseDelta(part2),
      sseDelta(part3),
      'data: [DONE]\n\n',
    ])

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: stream,
      text: () => Promise.resolve(''),
    } as unknown as Response)

    const generator = openAIFeedbackProvider.streamEvaluate({
      responseText:
        'Situation: latency spikes. Task: stabilize. Action: optimized queries. Result: 40% improvement.',
      question: { questionText: 'Describe a technical challenge' },
      airContext: null,
    })

    const events: StreamEvent[] = []
    for await (const event of generator) {
      events.push(event)
    }

    // Should have 3 intermediate chunk events + 1 final done event
    expect(events.length).toBe(4)

    // Intermediate events carry chunk text
    const intermediates = events.filter((e) => !e.done)
    expect(intermediates).toHaveLength(3)
    expect(intermediates[0].chunk).toBe(part1)
    expect(intermediates[1].chunk).toBe(part2)
    expect(intermediates[2].chunk).toBe(part3)

    // Final event has the normalized evaluation
    const final = events.find((e) => e.done)
    expect(final).toBeDefined()
    expect(final!.chunk).toBe('')
    expect(final!.evaluation).toBeDefined()
    expect(final!.evaluation!.scores.overall).toBe(77)
    expect(final!.evaluation!.strengths).toContain('Clear structure')
    expect(final!.evaluation!.suggestions).toContain('Add timeline context')
  })

  it('propagates fetch errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal server error'),
    } as unknown as Response)

    const generator = openAIFeedbackProvider.streamEvaluate({
      responseText: 'Some response',
      question: { questionText: 'Test question' },
      airContext: null,
    })

    await expect(generator.next()).rejects.toThrow('500')
  })

  it('includes AIR context metadata when airContext is provided', async () => {
    const stream = fakeSSEStream([
      sseDelta(VALID_JSON_EVALUATION),
      'data: [DONE]\n\n',
    ])

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: stream,
      text: () => Promise.resolve(''),
    } as unknown as Response)

    const airContext = {
      contextKey: 'technology:mid:backend_developer',
      targetJobTitle: 'Backend Engineer',
      industry: 'technology',
      seniority: 'mid',
      role: { id: 'backend_developer', label: 'Backend Developer' },
      competencies: ['api-design', 'reliability'],
    }

    const generator = openAIFeedbackProvider.streamEvaluate({
      responseText:
        'Situation: API issues. Task: fix. Action: refactored. Result: stable.',
      question: { questionText: 'Describe an API challenge' },
      airContext,
    })

    const events: StreamEvent[] = []
    for await (const event of generator) {
      events.push(event)
    }

    // Verify the prompt included AIR context (check fetch was called with body containing role info)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const fetchBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as { body: string }).body
    )
    const userMessage = fetchBody.messages.find(
      (m: { role: string }) => m.role === 'user'
    )
    expect(userMessage.content).toContain('Backend Developer')
    expect(userMessage.content).toContain('technology')

    // Final evaluation should exist
    const final = events.find((e) => e.done)
    expect(final?.evaluation).toBeDefined()
    expect(final?.evaluation?.scores.overall).toBe(77)
  })

  it('handles SSE stream that sends multiple data lines in a single chunk', async () => {
    // Single network read delivering all SSE lines at once
    const combinedChunk = sseDelta(VALID_JSON_EVALUATION) + 'data: [DONE]\n\n'

    const stream = fakeSSEStream([combinedChunk])

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: stream,
      text: () => Promise.resolve(''),
    } as unknown as Response)

    const generator = openAIFeedbackProvider.streamEvaluate({
      responseText: 'Some structured response.',
      question: { questionText: 'Test batched SSE' },
      airContext: null,
    })

    const events: StreamEvent[] = []
    for await (const event of generator) {
      events.push(event)
    }

    // 1 intermediate chunk + 1 final
    expect(events.length).toBe(2)
    const final = events.find((e) => e.done)
    expect(final?.evaluation?.scores?.overall).toBe(77)
  })
})
