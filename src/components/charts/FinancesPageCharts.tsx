import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(amount)
const formatShortCurrency = (amount: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1}).format(amount)

export function FinanceRevenueChart({ chartData }: { chartData: Array<{ name: string; Income: number; Salaries: number; "Other Expenses": number }> }) { return (<ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,.07)', fontSize: '12px' }}
                          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Bar isAnimationActive={false} dataKey="Income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                        <Bar isAnimationActive={false} dataKey="Salaries" stackId="costs" fill="#6366f1" maxBarSize={32} />
                        <Bar isAnimationActive={false} dataKey="Other Expenses" stackId="costs" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>) }

export function FinanceProfitChart({ cumulativePLData, netPL }: { cumulativePLData: Array<{ name: string; cumulative: number }>; netPL: number }) { return (<ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cumulativePLData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="plGradientPos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="plGradientNeg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v <= -1000 ? `-$${(Math.abs(v) / 1000).toFixed(0)}k` : `$${v}`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke={netPL >= 0 ? '#10b981' : '#ef4444'}
                          strokeWidth={2}
                          fill={netPL >= 0 ? 'url(#plGradientPos)' : 'url(#plGradientNeg)'}
                        />
                      </AreaChart>
                    </ResponsiveContainer>) }
