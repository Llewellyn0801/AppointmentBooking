import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('parent'); // 'parent' or 'admin'
  const [successMsg, setSuccessMsg] = useState('');

  // Initial fetch and Real-time subscription
  useEffect(() => {
    fetchSlots();

    // Subscribe to all changes on the public.slots table to update UI dynamically!
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slots' },
        (payload) => {
          console.log('Real-time database change detected:', payload);
          // A naive but simple refresh to constantly sync constraints:
          fetchSlots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('start_time', { ascending: true });
        
      if (error) throw error;
      setSlots(data || []);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the Supabase database. Did you set up the URL and ANON KEY?');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  return (
    <div>
      <h1>Parent-Teacher Meetings</h1>
      <p className="subtitle">Book your consultation slot today</p>

      {error && <div className="message error">{error}</div>}
      {successMsg && <div className="message success">{successMsg}</div>}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'parent' ? 'active' : ''}`}
          onClick={() => { setActiveTab('parent'); setError(''); }}
        >
          Parent View
        </button>
        <button 
          className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => { setActiveTab('admin'); setError(''); }}
        >
          Teacher/Admin View
        </button>
      </div>

      {loading && slots.length === 0 ? (
        <div className="loader"></div>
      ) : activeTab === 'parent' ? (
        <ParentView slots={slots} showSuccess={showSuccess} showError={showError} />
      ) : (
        <AdminView slots={slots} showSuccess={showSuccess} showError={showError} />
      )}
    </div>
  );
}

function ParentView({ slots, showSuccess, showError }) {
  const [selectedSlot, setSelectedSlot] = useState(null);

  const handleBook = async (slotId, parentName, parentEmail) => {
    try {
      // Direct call to our strictly atomic Supabase Postgres function!
      // This completely drops custom backend routing while remaining safe from concurrency
      const { data, error } = await supabase.rpc('book_slot', { 
        target_slot_id: slotId, 
        parent_name: parentName 
      });

      if (error) {
         throw new Error(error.message || 'Slot already taken');
      }
      
      showSuccess('Slot booked successfully!');
      setSelectedSlot(null);
      // Changes replicate through the real-time websocket, so we don't strictly need to refetch
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div>
      <h2>Available Slots</h2>
      <div className="slots-container">
        {slots.map(slot => (
          <SlotCard 
            key={slot.id} 
            slot={slot} 
            onAction={() => setSelectedSlot(slot)} 
            actionText="Book Slot"
            disabled={slot.booked_by !== null}
          />
        ))}
        {slots.length === 0 && <p style={{color: 'var(--text-muted)'}}>No slots available at the moment.</p>}
      </div>

      {selectedSlot && (
        <BookingModal 
          slot={selectedSlot} 
          onClose={() => setSelectedSlot(null)}
          onSubmit={(name, email) => handleBook(selectedSlot.id, name, email)}
        />
      )}
    </div>
  );
}

function AdminView({ slots, showSuccess, showError }) {
  const [teacherName, setTeacherName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Create valid ISO strings
      const startIso = new Date(startTime).toISOString();
      const endIso = new Date(endTime).toISOString();

      const { data, error } = await supabase
        .from('slots')
        .insert([
          { teacher_name: teacherName, start_time: startIso, end_time: endIso }
        ]);

      if (error) throw error;
      
      showSuccess('Slot created successfully');
      setStartTime('');
      setEndTime('');
    } catch (err) {
      showError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Administrative override just updates the field back to null directly
  const handleCancel = async (slotId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      const { error } = await supabase
        .from('slots')
        .update({ booked_by: null, booked_at: null })
        .eq('id', slotId);

      if (error) throw error;
      showSuccess('Booking cancelled');
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div>
      <div className="card" style={{marginBottom: '2rem'}}>
        <h2>Create New Slot</h2>
        <form onSubmit={handleCreateSlot}>
          <div className="form-group">
            <label>Teacher Name</label>
            <input 
              type="text" 
              required 
              value={teacherName} 
              onChange={e => setTeacherName(e.target.value)} 
              placeholder="e.g. Mrs. Davis"
            />
          </div>
          <div className="form-group">
            <label>Start Time</label>
            <input 
              type="datetime-local" 
              required 
              value={startTime}
              onChange={e => setStartTime(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label>End Time</label>
            <input 
              type="datetime-local" 
              required 
              value={endTime}
              onChange={e => setEndTime(e.target.value)} 
            />
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Slot'}
          </button>
        </form>
      </div>

      <h2>Manage Slots</h2>
      <div className="slots-container">
        {slots.map(slot => (
          <SlotCard 
            key={slot.id} 
            slot={slot} 
            onAction={slot.booked_by !== null ? () => handleCancel(slot.id) : null} 
            actionText="Cancel Booking"
            disabled={slot.booked_by === null}
            adminMode={true}
          />
        ))}
      </div>
    </div>
  );
}

function SlotCard({ slot, onAction, actionText, disabled, adminMode = false }) {
  const isBooked = slot.booked_by !== null;
  const statusDisplay = isBooked ? 'booked' : 'available';

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="card slot">
      <div className="slot-header">
        <span className="teacher-name">{slot.teacher_name}</span>
        <span className={`status-badge status-${statusDisplay}`}>
          {statusDisplay}
        </span>
      </div>
      <div className="slot-time">
        <span>📅 {formatDate(slot.start_time)}</span>
        <span>🕒 {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
      </div>
      
      {isBooked && (
        <div className="slot-booked-by">
          <strong>Booked by:</strong> {slot.booked_by}
        </div>
      )}

      {onAction && (
        <button 
          onClick={onAction} 
          disabled={disabled}
          className={adminMode ? "secondary" : ""}
          style={{marginTop: 'auto'}}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

function BookingModal({ slot, onClose, onSubmit }) {
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit(parentName, parentEmail);
    setIsSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal">
        <h2>Book Consultation</h2>
        <p style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>
          Meeting with <strong>{slot.teacher_name}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Parent Name</label>
            <input 
              type="text" 
              required 
              value={parentName} 
              onChange={e => setParentName(e.target.value)} 
              placeholder="Your Full Name"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              required 
              value={parentEmail} 
              onChange={e => setParentEmail(e.target.value)} 
              placeholder="name@example.com"
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Booking...' : 'Confirm Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
