import { useMemo, useState } from 'react';
import { useAppContext } from '../utils/app.context';
import { Message, PendingMessage } from '../utils/types';
import { classNames } from '../utils/misc';
import MarkdownDisplay, { CopyButton } from './MarkdownDisplay';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface SplitMessage {
  content: PendingMessage['content'];
  thought?: string;
  isThinking?: boolean;
}

export default function ChatMessage({
  msg,
  siblingLeafNodeIds,
  siblingCurrIdx,
  id,
  onRegenerateMessage,
  onEditMessage,
  onChangeSibling,
  isPending,
  onContinueMessage,
}: {
  msg: Message | PendingMessage;
  siblingLeafNodeIds: Message['id'][];
  siblingCurrIdx: number;
  id?: string;
  onRegenerateMessage(msg: Message): void;
  onEditMessage(msg: Message, content: string): void;
  onContinueMessage(msg: Message, content: string): void;
  onChangeSibling(sibling: Message['id']): void;
  isPending?: boolean;
}) {
  const { viewingChat, config } = useAppContext();
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const timings = useMemo(
    () =>
      msg.timings
        ? {
            ...msg.timings,
            prompt_per_second:
              (msg.timings.prompt_n / msg.timings.prompt_ms) * 1000,
            predicted_per_second:
              (msg.timings.predicted_n / msg.timings.predicted_ms) * 1000,
          }
        : null,
    [msg.timings]
  );
  const nextSibling = siblingLeafNodeIds[siblingCurrIdx + 1];
  const prevSibling = siblingLeafNodeIds[siblingCurrIdx - 1];

  // for reasoning model, we split the message into content and thought
  // TODO: implement this as remark/rehype plugin in the future
  const { content, thought, isThinking }: SplitMessage = useMemo(() => {
    if (msg.content === null || msg.role !== 'assistant') {
      return { content: msg.content };
    }
    let actualContent = '';
    let thought = '';
    let isThinking = false;
    let thinkSplit = msg.content.split('<think>', 2);
    actualContent += thinkSplit[0];
    while (thinkSplit[1] !== undefined) {
      // <think> tag found
      thinkSplit = thinkSplit[1].split('</think>', 2);
      thought += thinkSplit[0];
      isThinking = true;
      if (thinkSplit[1] !== undefined) {
        // </think> closing tag found
        isThinking = false;
        thinkSplit = thinkSplit[1].split('<think>', 2);
        actualContent += thinkSplit[0];
      }
    }
    return { content: actualContent, thought, isThinking };
  }, [msg]);

  if (!viewingChat) return null;

  return (
    <div className="group" id={id}>
      <div
        className={classNames({
          chat: true,
          'chat-start': msg.role !== 'user',
          'chat-end': msg.role === 'user',
        })}
      >
        <div
          className={classNames({
            'chat-bubble markdown': true,
            'chat-bubble-base-300': msg.role !== 'user',
          })}
        >
          {/* textarea for editing message */}
          {editingContent !== null && (
            <>
              <textarea
                dir="auto"
                className="textarea textarea-bordered bg-base-100 text-base-content max-w-2xl w-[calc(90vw-8em)] h-24"
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
              ></textarea>
              <br />
              <button
                className="btn btn-ghost mt-2 mr-2"
                onClick={() => setEditingContent(null)}
              >
                Cancel
              </button>
              <button
                className="btn mt-2"
                onClick={() => {
                  if (msg.content !== null) {
                    setEditingContent(null);
                    if (msg.role === 'user') {
                      onEditMessage(msg as Message, editingContent);
                    } else {
                      onContinueMessage(msg as Message, editingContent);
                    }
                  }
                }}
              >
                Submit
              </button>
            </>
          )}
          {/* not editing content, render message */}
          {editingContent === null && (
            <>
              {content === null ? (
                <>
                  {/* show loading dots for pending message */}
                  <span className="loading loading-dots loading-md"></span>
                </>
              ) : (
                <>
                  {/* render message as markdown */}
                  <div dir="auto">
                    {thought && (
                      <details
                        className="collapse bg-base-200 collapse-arrow mb-4"
                        open={isThinking && config.showThoughtInProgress}
                      >
                        <summary className="collapse-title">
                          {isPending && isThinking ? (
                            <span>
                              <span
                                v-if="isGenerating"
                                className="loading loading-spinner loading-md mr-2"
                                style={{ verticalAlign: 'middle' }}
                              ></span>
                              <b>Thinking</b>
                            </span>
                          ) : (
                            <b>Thought Process</b>
                          )}
                        </summary>
                        <div className="collapse-content">
                          <MarkdownDisplay
                            content={thought}
                            isGenerating={isPending}
                          />
                        </div>
                      </details>
                    )}

                    {msg.extra && msg.extra.length > 0 && (
                      <details
                        className={classNames({
                          'collapse collapse-arrow mb-4 bg-base-200': true,
                          'bg-opacity-10': msg.role !== 'assistant',
                        })}
                      >
                        <summary className="collapse-title">
                          Extra content
                        </summary>
                        <div className="collapse-content">
                          {msg.extra.map(
                            (extra, i) =>
                              extra.type === 'textFile' ? (
                                <div key={extra.name}>
                                  <b>{extra.name}</b>
                                  <pre>{extra.content}</pre>
                                </div>
                              ) : extra.type === 'context' ? (
                                <div key={i}>
                                  <pre>{extra.content}</pre>
                                </div>
                              ) : null // TODO: support other extra types
                          )}
                        </div>
                      </details>
                    )}

                    <MarkdownDisplay
                      content={content}
                      isGenerating={isPending}
                    />
                  </div>
                </>
              )}
              {/* render timings if enabled */}
              {timings && config.showTokensPerSecond && (
                <div className="dropdown dropdown-hover dropdown-top mt-2">
                  <div
                    tabIndex={0}
                    role="button"
                    className="cursor-pointer font-semibold text-sm opacity-60"
                  >
                    Speed: {timings.predicted_per_second.toFixed(1)} t/s
                  </div>
                  <div className="dropdown-content bg-base-100 z-10 w-64 p-2 shadow mt-4">
                    <b>Prompt</b>
                    <br />- Tokens: {timings.prompt_n}
                    <br />- Time: {timings.prompt_ms} ms
                    <br />- Speed: {timings.prompt_per_second.toFixed(1)} t/s
                    <br />
                    <b>Generation</b>
                    <br />- Tokens: {timings.predicted_n}
                    <br />- Time: {timings.predicted_ms} ms
                    <br />- Speed: {timings.predicted_per_second.toFixed(1)} t/s
                    <br />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* actions for each message */}
      {msg.content !== null && (
        <div
          className={classNames({
            'flex items-center gap-2 mx-4 mt-2 mb-2': true,
            'flex-row-reverse': msg.role === 'user',
          })}
        >
          {siblingLeafNodeIds && siblingLeafNodeIds.length > 1 && (
            <div className="flex gap-1 items-center opacity-60 text-sm">
              <button
                className={classNames({
                  'btn btn-sm btn-ghost p-1': true,
                  'opacity-20': !prevSibling,
                })}
                onClick={() => prevSibling && onChangeSibling(prevSibling)}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span>
                {siblingCurrIdx + 1} / {siblingLeafNodeIds.length}
              </span>
              <button
                className={classNames({
                  'btn btn-sm btn-ghost p-1': true,
                  'opacity-20': !nextSibling,
                })}
                onClick={() => nextSibling && onChangeSibling(nextSibling)}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          {/* user message */}
          {msg.role === 'user' && (
            <button
              className="badge btn-mini show-on-hover"
              onClick={() => setEditingContent(msg.content)}
              disabled={msg.content === null}
            >
              ✍️ Edit
            </button>
          )}
          {/* assistant message */}
          {msg.role === 'assistant' && (
            <>
              {!isPending && (
                <button
                  className="badge btn-mini show-on-hover mr-2"
                  onClick={() => {
                    if (msg.content !== null) {
                      onRegenerateMessage(msg as Message);
                    }
                  }}
                  disabled={msg.content === null}
                >
                  🔄 Regenerate
                </button>
              )}
              {!isPending && (
                <button
                  className="badge btn-mini show-on-hover"
                  onClick={() => setEditingContent(msg.content)}
                  disabled={msg.content === null}
                >
                   ✍️ Edit
                </button>
              )}
            </>
          )}
          <CopyButton
            className="badge btn-mini show-on-hover mr-2"
            content={msg.content}
          />
        </div>
      )}
    </div>
  );
}
