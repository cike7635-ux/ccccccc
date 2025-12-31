// /app/admin/keys/components/AbsoluteDateSelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { Calendar, CalendarDays, X, Check } from 'lucide-react'

interface AbsoluteDateSelectorProps {
  value: string // ISO日期字符串
  onChange: (date: string) => void
  minDate?: string // 最小日期
  maxDate?: string // 最大日期
  className?: string
}

export default function AbsoluteDateSelector({
  value,
  onChange,
  minDate,
  maxDate,
  className = ''
}: AbsoluteDateSelectorProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(value || '')
  const [tempDate, setTempDate] = useState(value || '')

  // 格式化日期显示
  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '请选择日期'
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  // 获取日期选项
  const getDateOptions = () => {
    const options = []
    const today = new Date()
    
    // 今天
    const todayStr = today.toISOString().split('T')[0]
    options.push({
      value: todayStr,
      label: '今天',
      display: today.toLocaleDateString('zh-CN')
    })

    // 明天
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    options.push({
      value: tomorrowStr,
      label: '明天',
      display: tomorrow.toLocaleDateString('zh-CN')
    })

    // 7天后
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = nextWeek.toISOString().split('T')[0]
    options.push({
      value: nextWeekStr,
      label: '一周后',
      display: nextWeek.toLocaleDateString('zh-CN')
    })

    // 30天后
    const nextMonth = new Date(today)
    nextMonth.setDate(nextMonth.getDate() + 30)
    const nextMonthStr = nextMonth.toISOString().split('T')[0]
    options.push({
      value: nextMonthStr,
      label: '一个月后',
      display: nextMonth.toLocaleDateString('zh-CN')
    })

    // 90天后
    const threeMonths = new Date(today)
    threeMonths.setDate(threeMonths.getDate() + 90)
    const threeMonthsStr = threeMonths.toISOString().split('T')[0]
    options.push({
      value: threeMonthsStr,
      label: '三个月后',
      display: threeMonths.toLocaleDateString('zh-CN')
    })

    // 365天后
    const nextYear = new Date(today)
    nextYear.setDate(nextYear.getDate() + 365)
    const nextYearStr = nextYear.toISOString().split('T')[0]
    options.push({
      value: nextYearStr,
      label: '一年后',
      display: nextYear.toLocaleDateString('zh-CN')
    })

    return options
  }

  // 处理日期选择
  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr)
    setTempDate(dateStr)
    onChange(dateStr)
    setShowCalendar(false)
  }

  // 处理自定义日期输入
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setTempDate(newDate)
  }

  // 确认自定义日期
  const confirmCustomDate = () => {
    if (tempDate) {
      handleDateSelect(tempDate)
    }
  }

  // 清除选择
  const clearDate = () => {
    setSelectedDate('')
    setTempDate('')
    onChange('')
    setShowCalendar(false)
  }

  // 初始化
  useEffect(() => {
    if (!value) {
      const today = new Date()
      const defaultDate = today.toISOString().split('T')[0]
      setSelectedDate(defaultDate)
      setTempDate(defaultDate)
      onChange(defaultDate)
    }
  }, [value, onChange])

  return (
    <div className={`relative ${className}`}>
      {/* 显示当前选择的日期 */}
      <button
        type="button"
        onClick={() => setShowCalendar(!showCalendar)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-left flex items-center justify-between hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center">
          <CalendarDays className="w-4 h-4 mr-2 text-purple-400" />
          <span className={selectedDate ? 'text-white' : 'text-gray-400'}>
            {formatDisplayDate(selectedDate)}
          </span>
        </div>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {/* 日历选择器 */}
      {showCalendar && (
        <div className="absolute top-full left-0 mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 animate-slide-down">
          <div className="p-4">
            {/* 快捷选项 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">快捷选择</h4>
              <div className="grid grid-cols-2 gap-2">
                {getDateOptions().map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleDateSelect(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedDate === option.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-75">{option.display}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义日期选择 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">选择具体日期</h4>
              <div className="flex items-center space-x-3">
                <input
                  type="date"
                  value={tempDate}
                  onChange={handleCustomDateChange}
                  min={minDate || new Date().toISOString().split('T')[0]}
                  max={maxDate}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
                <button
                  type="button"
                  onClick={confirmCustomDate}
                  className="px-3 py-2 bg-purple-600 hover:opacity-90 rounded-lg text-white flex items-center"
                  disabled={!tempDate}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={clearDate}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 日期信息 */}
            {selectedDate && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-purple-400 mr-2" />
                  <div>
                    <p className="text-sm text-purple-300">
                      已选择: {formatDisplayDate(selectedDate)}
                    </p>
                    <p className="text-xs text-purple-400 mt-1">
                      密钥必须在此日期前激活使用
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}