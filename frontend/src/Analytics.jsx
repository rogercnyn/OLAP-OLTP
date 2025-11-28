import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts';
import './Analytics.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const APPLE_COLORS = {
  blue: '#007aff',
  green: '#34c759',
  orange: '#ff9500',
  red: '#ff375f',
  purple: '#5856d6',
  teal: '#5ac8fa',
  pink: '#ff2d55',
  gray: '#8e8e93'
};

const CHART_COLORS = [
  APPLE_COLORS.blue,
  APPLE_COLORS.green,
  APPLE_COLORS.orange,
  APPLE_COLORS.purple,
  APPLE_COLORS.teal,
  APPLE_COLORS.pink
];

// --- Formatting helpers ---
const formatShortDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatLongDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatAxisCurrency = (value) => {
  if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₱${Math.round(value / 1000)}k`;
  return `₱${value}`;
};

const formatTooltipCurrency = (value) => {
  const numeric = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
  return `₱${numeric.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
};

function Analytics() {
  const [summary, setSummary] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [movieData, setMovieData] = useState([]);
  const [timeslotData, setTimeslotData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const [summaryRes, revenueRes, movieRes, timeslotRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/summary`),
        fetch(`${API_URL}/api/analytics/revenue`),
        fetch(`${API_URL}/api/analytics/movies`),
        fetch(`${API_URL}/api/analytics/timeslots`)
      ]);

      if (!summaryRes.ok || !revenueRes.ok || !movieRes.ok || !timeslotRes.ok) {
        throw new Error('One or more analytics endpoints returned an error');
      }

      const summaryData = await summaryRes.json();
      const revenueRaw = await revenueRes.json();
      const movies = await movieRes.json();
      const timeslots = await timeslotRes.json();

      setSummary(summaryData);

      // Normalize revenue data and sort ascending by date
      setRevenueData(
        (revenueRaw || [])
          .map(item => ({
            ...item,
            daily_revenue: isNaN(parseFloat(item.daily_revenue)) ? 0 : parseFloat(item.daily_revenue)
          }))
          .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
      );
      
      // Parse movie data to ensure numbers
      setMovieData(movies.map(m => ({
        ...m,
        total_revenue: parseFloat(m.total_revenue),
        total_seats: parseInt(m.total_seats),
        days_shown: parseInt(m.days_shown),
        avg_revenue_per_booking: parseFloat(m.avg_revenue_per_booking)
      })));
      
      setTimeslotData(timeslots || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load analytics. Please refresh to try again.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  // Group timeslot data by time of day
  const timeOfDayData = timeslotData.reduce((acc, item) => {
    const existing = acc.find(x => x.time_of_day === item.time_of_day);
    if (existing) {
      existing.booking_count += parseInt(item.booking_count);
      existing.revenue += parseFloat(item.revenue);
    } else {
      acc.push({
        time_of_day: item.time_of_day,
        booking_count: parseInt(item.booking_count),
        revenue: parseFloat(item.revenue)
      });
    }
    return acc;
  }, []);

  // Sort time of day in logical order
  const timeOrder = ['Morning', 'Afternoon', 'Evening', 'Night', 'Late Night'];
  const sortedTimeOfDayData = timeOfDayData.sort((a, b) => {
    return timeOrder.indexOf(a.time_of_day) - timeOrder.indexOf(b.time_of_day);
  });

  return (
    <div className="analytics-container">
      <h1>Analytics Dashboard</h1>
      
      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Total Revenue</h3>
            <p className="metric">₱{parseFloat(summary.total_revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="summary-card">
            <h3>Total Bookings</h3>
            <p className="metric">{parseInt(summary.total_bookings || 0).toLocaleString()}</p>
          </div>
          <div className="summary-card">
            <h3>Seats Sold</h3>
            <p className="metric">{parseInt(summary.total_seats_sold || 0).toLocaleString()}</p>
          </div>
          <div className="summary-card">
            <h3>Average Order</h3>
            <p className="metric">₱{parseFloat(summary.avg_booking_value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Revenue Trend - Area Chart */}
      <div className="chart-section">
        <div className="chart-header">
          <div>
            <h2>Revenue Trend</h2>
            <p className="chart-subtitle">Daily revenue over the last 30 days</p>
          </div>
          <button 
            className="refresh-btn" 
            onClick={() => fetchAnalytics(true)} 
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>

        {error ? (
          <div className="analytics-empty">
            {error}
            <button 
              className="refresh-btn inline"
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
            >
              Retry
            </button>
          </div>
        ) : (!revenueData || revenueData.length === 0) ? (
          <div className="analytics-empty">
            No revenue data available for the selected period.
            <button 
              className="refresh-btn inline"
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
            >
              Reload
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart 
              data={revenueData}
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={APPLE_COLORS.blue} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={APPLE_COLORS.blue} stopOpacity={0.05}/>
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />

              <XAxis 
                dataKey="booking_date"
                tickFormatter={formatShortDate}
                stroke="#a1a1a1"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />

              <YAxis 
                stroke="#a1a1a1"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisCurrency}
                width={75}
                tick={{ fontSize: 12 }}
              />

              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(26, 26, 26, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                  padding: '12px 16px',
                  color: '#ffffff'
                }}
                labelFormatter={formatLongDate}
                formatter={(value) => [formatTooltipCurrency(value), 'Revenue']}
              />

              <Area 
                type="monotone" 
                dataKey="daily_revenue" 
                stroke={APPLE_COLORS.blue}
                strokeWidth={3}
                fill="url(#colorRevenue)"
                dot={{ fill: APPLE_COLORS.blue, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 7, strokeWidth: 0, fill: APPLE_COLORS.blue }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Movie Performance Chart - Horizontal Bars */}
      <div className="chart-section">
        <h2>Top Performing Movies</h2>
        <p className="chart-subtitle">Revenue comparison across movies</p>
        <div className="time-distribution">
          {movieData
            .sort((a, b) => b.total_revenue - a.total_revenue)
            .map((movie, index) => {
              const maxRevenue = Math.max(...movieData.map(m => m.total_revenue));
              const percentage = (movie.total_revenue / maxRevenue) * 100;
              const colorIndex = index % CHART_COLORS.length;
              
              return (
                <div key={movie.movie_title} className="time-slot-row">
                  <div className="time-slot-label">
                    <span className="time-name">{movie.movie_title}</span>
                    <span className="time-count">{movie.total_seats} seats sold</span>
                  </div>
                  <div className="time-slot-bar-container">
                    <div 
                      className="time-slot-bar"
                      style={{ 
                        width: `${percentage}%`,
                        background: `linear-gradient(90deg, ${CHART_COLORS[colorIndex]}, ${CHART_COLORS[colorIndex]}dd)`,
                        boxShadow: `0 0 20px ${CHART_COLORS[colorIndex]}40`
                      }}
                    >
                      <span className="time-slot-revenue">
                        ₱{parseFloat(movie.total_revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Time Slot Distribution - Radial */}
      <div className="chart-section">
        <h2>Peak Booking Hours</h2>
        <p className="chart-subtitle">Popular time slots throughout the day</p>
        <div className="radial-chart-container">
          <ResponsiveContainer width="100%" height={500}>
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="20%" 
              outerRadius="90%" 
              data={sortedTimeOfDayData.map((slot, index) => {
                const maxCount = Math.max(...sortedTimeOfDayData.map(d => d.booking_count));
                return {
                  ...slot,
                  fill: CHART_COLORS[index % CHART_COLORS.length],
                  value: (slot.booking_count / maxCount) * 100
                };
              })}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                minAngle={15}
                background={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                clockWise
                dataKey="value"
                cornerRadius={10}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(26, 26, 26, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                  padding: '16px 20px',
                  color: '#ffffff'
                }}
                labelStyle={{ display: 'none' }}
                itemStyle={{ color: '#ffffff' }}
                formatter={(value, name, props) => {
                  return [
                    <div key="content" style={{ fontSize: '0.95em', lineHeight: '1.6' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '1.05em' }}>
                        {props.payload.time_of_day}
                      </div>
                      <div>{props.payload.booking_count} bookings</div>
                      <div style={{ color: '#34c759', fontWeight: '600' }}>
                        ₱{parseFloat(props.payload.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ];
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="radial-legend">
            {sortedTimeOfDayData.map((slot, index) => (
              <div key={index} className="radial-legend-item">
                <span 
                  className="legend-color" 
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                ></span>
                <span className="legend-title">{slot.time_of_day}</span>
                <span className="legend-revenue">
                  {slot.booking_count} bookings
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="chart-section">
        <h2>Detailed Movie Performance</h2>
        <p className="chart-subtitle">Complete breakdown of each movie's metrics</p>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Movie</th>
              <th>Revenue</th>
              <th>Seats Sold</th>
              <th>Days Shown</th>
              <th>Avg per Booking</th>
            </tr>
          </thead>
          <tbody>
            {movieData.map((movie, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 500 }}>{movie.movie_title}</td>
                <td style={{ color: APPLE_COLORS.green, fontWeight: 600 }}>
                  ₱{parseFloat(movie.total_revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
                <td>{parseInt(movie.total_seats).toLocaleString()}</td>
                <td>{movie.days_shown}</td>
                <td>₱{parseFloat(movie.avg_revenue_per_booking).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Analytics;
