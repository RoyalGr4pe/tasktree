'use client'

import { format, isValid, parseISO } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

interface DueDatePickerProps {
    taskId: string
    current: string | null
    anchorEl?: React.ReactNode
    onSelect: (taskId: string, date: string | null) => void
}

export function DueDatePicker({
    taskId,
    current,
    anchorEl,
    onSelect,
}: DueDatePickerProps) {
    const selected =
        current && isValid(parseISO(current)) ? parseISO(current) : undefined

    function handleSelect(date: Date | undefined) {
        onSelect(taskId, date ? format(date, 'yyyy-MM-dd') : null)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                {anchorEl}
            </PopoverTrigger>

            <PopoverContent
                className="w-auto p-0 rounded-xl"
                align="start"
                side="left"
                sideOffset={8}
                avoidCollisions={true}
                collisionPadding={10}
            >
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={handleSelect}
                    className="rounded-xl"
                />

                <div className="border-t px-3 py-2">
                    {current ? (
                        <button
                            onClick={() => handleSelect(undefined)}
                            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
                        >
                            Clear due date
                        </button>
                    ) : (
                        <span className="text-sm text-muted-foreground">
                            Pick a date
                        </span>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export { formatDueDate, isDueDateOverdue } from './utils';
