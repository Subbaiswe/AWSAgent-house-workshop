import { useState } from 'react'

export default function ToolTag({ toolBlock }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasInput = toolBlock.input && Object.keys(toolBlock.input).length > 0
  const isSubAgent = toolBlock.isSubAgent || false

  return (
    <div className="flex flex-col my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors text-sm w-fit ${
          isSubAgent
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-amber-50 border border-amber-200'
        }`}
      >
        <span className={isSubAgent ? 'text-blue-700' : 'text-amber-700'}>
          {isSubAgent ? '↳' : '🔧'}
        </span>
        <span className={`font-medium ${isSubAgent ? 'text-blue-900' : 'text-amber-900'}`}>
          {toolBlock.name}
        </span>
        {hasInput && (
          <span className={`text-xs ${isSubAgent ? 'text-blue-600' : 'text-amber-600'}`}>
            ({Object.keys(toolBlock.input).length} {Object.keys(toolBlock.input).length === 1 ? 'arg' : 'args'})
          </span>
        )}
        <span className={`text-xs ${isSubAgent ? 'text-blue-600' : 'text-amber-600'}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && hasInput && (
        <div className="mt-2 ml-4 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
          <pre className="text-gray-700 overflow-x-auto">
            {JSON.stringify(toolBlock.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
