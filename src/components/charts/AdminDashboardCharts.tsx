import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(amount)
const formatShortCurrency = (amount: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1}).format(amount)

export function DashboardRevenueChart({ financeSeries }: { financeSeries: Array<{ label: string; revenue: number; burn: number; net: number }> }) { return (<ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dashboardBurn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => formatShortCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid rgba(148,163,184,0.18)',
                      boxShadow: '0 24px 48px -28px rgba(15,23,42,0.24)',
                    }}
                  />
                  <Area isAnimationActive={false} type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" fill="url(#dashboardRevenue)" strokeWidth={2.4} />
                  <Area isAnimationActive={false} type="monotone" dataKey="burn" name="Burn" stroke="#dc2626" fill="url(#dashboardBurn)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>) }
