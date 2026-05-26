import ToolTag from './ToolTag'
import InterruptApproval from './InterruptApproval'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ChatMessage({ message, isStreaming, onApprove, onReject, respondedInterrupts }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
            : 'bg-white text-gray-800 rounded-bl-none border border-gray-200 shadow-sm'
        }`}
      >
        <div className="text-sm leading-relaxed">
          {!isUser && message.contentBlocks && message.contentBlocks.length > 0 ? (
            <div className="space-y-2">
              {message.contentBlocks.map((block, index) => {
                if (block.type === 'text') {
                  const isLastBlock = index === message.contentBlocks.length - 1
                  return (
                    <div key={`text-${index}`} className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-table:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                      {isStreaming && isLastBlock && (
                        <span className="inline-block ml-0.5 text-emerald-600 animate-cursor-blink">
                          ▋
                        </span>
                      )}
                    </div>
                  )
                } else if (block.type === 'sub_text') {
                  return (
                    <div key={`sub-text-${index}`} className="ml-8 relative">
                      <div className="absolute left-[-1rem] top-0 bottom-0 w-px bg-blue-300"></div>
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-table:my-2 text-gray-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                      </div>
                    </div>
                  )
                } else if (block.type === 'tool') {
                  if (block.toolBlock.isSubAgent) {
                    return (
                      <div key={`tool-${block.toolBlock.toolUseId}`} className="ml-8 relative">
                        <div className="absolute left-[-1rem] top-0 bottom-0 w-px bg-blue-300"></div>
                        <ToolTag toolBlock={block.toolBlock} />
                      </div>
                    )
                  }
                  return (
                    <ToolTag
                      key={`tool-${block.toolBlock.toolUseId}`}
                      toolBlock={block.toolBlock}
                    />
                  )
                } else if (block.type === 'interrupt') {
                  return (
                    <InterruptApproval
                      key={`interrupt-${block.interrupt.interrupt_id}`}
                      interrupt={block.interrupt}
                      onApprove={onApprove}
                      onReject={onReject}
                      responseType={respondedInterrupts?.get(block.interrupt.interrupt_id)}
                    />
                  )
                }
                return null
              })}
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}
        </div>

        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-emerald-100' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
