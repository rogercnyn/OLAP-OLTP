import React, { useState, useEffect } from 'react';
import Analytics from './Analytics';
import './App.css';

// --- CONSTANTS & MOCK DATA ---
const POSTER_MAP = {
  "Quezon": "/posters/quezon.jpg",
  "Predator: Badlands": "/posters/predator.jpg",
  "Die, My Love": "/posters/die-my-love.jpg",
  "Bugonia": "/posters/bugonia.jpg",
  "Wicked: For Good": "/posters/wicked.jpg",
  "Meet, Greet & Bye": "/posters/meet-greet.jpg"
};
const FALLBACK_POSTER = "https://via.placeholder.com/300x450?text=No+Poster";

const getDates = () => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

function App() {
  // --- STATE MANAGEMENT ---
  const [currentView, setCurrentView] = useState('booking'); // 'booking' or 'analytics'
  const [dates] = useState(getDates());
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [movies, setMovies] = useState([]);
  
  // Modal & Flow State
  const [showModal, setShowModal] = useState(false);
  const [bookingStep, setBookingStep] = useState('SEATS'); // 'SEATS' or 'PAYMENT'
  const [selectedShowtime, setSelectedShowtime] = useState(null); 
  
  // Seat Selection State
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookingStatus, setBookingStatus] = useState('');

  // Payment Form State
  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '', expiry: '', cvv: '', name: ''
  });

  // --- CRITICAL HELPER: GRID LAYOUT ---
  const getGridColumn = (seatNum) => {
    if (seatNum > 15) return seatNum + 2; 
    if (seatNum > 5) return seatNum + 1;
    return seatNum;
  };

  // --- API CALLS ---
  useEffect(() => {
    fetch(`http://localhost:3000/api/schedule?date=${selectedDate}`)
      .then(res => res.json())
      .then(data => setMovies(data))
      .catch(err => console.error("Error fetching movies:", err));
  }, [selectedDate]);

  const handleShowtimeClick = (showtimeId, movieTitle, time, price) => {
    setSelectedShowtime({ id: showtimeId, title: movieTitle, time, price });
    setBookingStatus('');
    setSelectedSeats([]);
    setBookingStep('SEATS'); // Reset flow
    setPaymentDetails({ cardNumber: '', expiry: '', cvv: '', name: '' }); // Clear form
    
    fetch(`http://localhost:3000/api/showtimes/${showtimeId}/seats`)
      .then(res => res.json())
      .then(data => {
        setSeats(data);
        setShowModal(true);
      });
  };

  const toggleSeat = (seatId) => {
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter(id => id !== seatId));
    } else {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  // --- UPDATED: SMART FORM HANDLING ---
  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cardNumber') {
      // Remove non-digits
      const raw = value.replace(/\D/g, '');
      // Add space every 4 digits
      formattedValue = raw.replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19); // 16 digits + 3 spaces
    } else if (name === 'expiry') {
      // Remove non-digits
      const raw = value.replace(/\D/g, '');
      // Insert slash after 2 digits
      if (raw.length >= 2) {
        formattedValue = `${raw.slice(0, 2)}/${raw.slice(2, 4)}`;
      } else {
        formattedValue = raw;
      }
    } else if (name === 'cvv') {
      // Only allow numbers, max 3 digits
      formattedValue = value.replace(/\D/g, '').slice(0, 3);
    }

    setPaymentDetails({ ...paymentDetails, [name]: formattedValue });
  };

  const submitBooking = async () => {
    setBookingStatus('Processing Payment...');
    try {
      const res = await fetch('http://localhost:3000/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showtimeId: selectedShowtime.id,
          seats: selectedSeats.map(id => ({
            id,
            price: selectedShowtime.price
          })),
          customerName: paymentDetails.name,
          customerEmail: "test@example.com", 
          paymentMethod: "card",
          paymentAmount: selectedSeats.length * selectedShowtime.price
        })
      });

      if (res.ok) {
        setBookingStatus('Success!');
        setTimeout(() => setShowModal(false), 1500);
      } else if (res.status === 409) {
        setBookingStatus('Error: Seats were just taken!');
        const refreshRes = await fetch(`http://localhost:3000/api/showtimes/${selectedShowtime.id}/seats`);
        const refreshData = await refreshRes.json();
        setSeats(refreshData);
        setSelectedSeats([]);
        setBookingStep('SEATS'); 
      } else {
        setBookingStatus('Error occurred.');
      }
    } catch (err) {
      setBookingStatus('Network error.');
    }
  };

  const totalPrice = selectedShowtime ? selectedSeats.length * parseFloat(selectedShowtime.price) : 0;

  // Show analytics if selected
  if (currentView === 'analytics') {
    return (
      <div className="app-container">
        <header>
          <h1>Movie Booking System</h1>
          <button className="nav-btn" onClick={() => setCurrentView('booking')}>
            🎬 Back to Booking
          </button>
        </header>
        <Analytics />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <h1>Movie Booking System</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            className="date-picker" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {dates.map(d => (
              <option key={d} value={d}>
                {new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>
          <button className="nav-btn" onClick={() => setCurrentView('analytics')}>
            📊 Analytics
          </button>
        </div>
      </header>

      <div className="movies-grid">
        {movies.map(movie => (
          <div key={movie.id} className="movie-card">
            <div className="poster-wrapper">
              <img 
                 src={POSTER_MAP[movie.title] || FALLBACK_POSTER} 
                 alt={movie.title} 
                 className="movie-poster"
                 onError={(e) => { e.target.src = FALLBACK_POSTER; }}
              />
            </div>
            <div className="card-details">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span className="cinema-tag">Cinema</span>
                <span style={{color: '#2ecc71', fontWeight: 'bold', fontSize: '0.9rem'}}>
                  ₱{movie.price}
                </span>
              </div>
              <h3 className="movie-title">{movie.title}</h3>
              <div className="showtimes-list">
                {movie.showtimes.map(st => (
                  <button 
                    key={st.id} 
                    className="time-chip"
                    onClick={() => handleShowtimeClick(st.id, movie.title, st.time, movie.price)}
                  >
                    {st.time}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && selectedShowtime && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            
            <h2>{selectedShowtime.title}</h2>
            <p style={{color: '#888', marginBottom: '20px'}}>
              {selectedShowtime.time} • {selectedSeats.length} Seats Selected
            </p>

            {/* --- STEP 1: SEAT SELECTION --- */}
            {bookingStep === 'SEATS' && (
              <>
                <div className="screen-text">SCREEN</div>
                <div className="screen-bar"></div>

                <div className="seats-grid">
                  {seats.map(seat => (
                    <button
                      key={seat.id}
                      className={`seat ${seat.status === 'TAKEN' ? 'taken' : ''} ${selectedSeats.includes(seat.id) ? 'selected' : ''}`}
                      disabled={seat.status === 'TAKEN'}
                      onClick={() => toggleSeat(seat.id)}
                      style={{ gridColumn: getGridColumn(seat.number) }}
                    >
                      {seat.row_code}{seat.number}
                    </button>
                  ))}
                </div>

                <div style={{marginTop: '20px'}}>
                    <button 
                        className="confirm-btn" 
                        disabled={selectedSeats.length === 0}
                        onClick={() => setBookingStep('PAYMENT')}
                    >
                        Proceed to Payment (₱{totalPrice.toLocaleString()})
                    </button>
                </div>
              </>
            )}

            {/* --- STEP 2: PAYMENT FORM --- */}
            {bookingStep === 'PAYMENT' && (
              <div className="payment-form">
                <div className="summary-total">
                    Total: ₱{totalPrice.toLocaleString()}
                </div>

                <div className="form-group">
                    <label>Cardholder Name</label>
                    <input 
                        type="text" name="name" className="form-control" placeholder="Juan Dela Cruz" 
                        value={paymentDetails.name} onChange={handlePaymentChange}
                    />
                </div>
                <div className="form-group">
                    <label>Card Number</label>
                    <input 
                        type="text" 
                        name="cardNumber" 
                        className="form-control" 
                        placeholder="0000 0000 0000 0000" 
                        value={paymentDetails.cardNumber} 
                        onChange={handlePaymentChange}
                        maxLength="19"
                    />
                </div>
                <div className="form-row">
                    <div className="form-group" style={{flex: 1}}>
                        <label>Expiry (MM/YY)</label>
                        <input 
                            type="text" 
                            name="expiry" 
                            className="form-control" 
                            placeholder="MM/YY" 
                            value={paymentDetails.expiry} 
                            onChange={handlePaymentChange}
                            maxLength="5"
                        />
                    </div>
                    <div className="form-group" style={{flex: 1}}>
                        <label>CVV</label>
                        <input 
                            type="text" 
                            name="cvv" 
                            className="form-control" 
                            placeholder="123" 
                            value={paymentDetails.cvv} 
                            onChange={handlePaymentChange}
                            maxLength="3"
                        />
                    </div>
                </div>

                <div style={{display: 'flex', marginTop: '20px'}}>
                    <button className="back-btn" onClick={() => setBookingStep('SEATS')}>
                        Back
                    </button>
                    <button 
                        className={`confirm-btn ${bookingStatus === 'Success!' ? 'success' : bookingStatus.startsWith('Error') ? 'error' : ''}`}
                        onClick={submitBooking}
                    >
                        {bookingStatus || `Pay ₱${totalPrice.toLocaleString()}`}
                    </button>
                </div>
              </div>
            )}
             
          </div>
        </div>
      )}
    </div>
  );
}

export default App;