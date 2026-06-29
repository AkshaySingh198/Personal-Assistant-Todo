import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import { Calendar, RefreshCw } from 'lucide-react';

const HoverablePin = ({ eventInfo }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { event } = eventInfo;
  const isGoogle = event.extendedProps.source === 'google';
  const pinSymbol = isGoogle ? '🌐' : '📌';

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
      }}
    >
      <div 
        style={{ 
          width: '26px', 
          height: '26px', 
          borderRadius: '50%', 
          backgroundColor: event.backgroundColor || '#3b82f6', 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          transition: 'transform 0.15s ease-in-out',
          transform: isHovered ? 'scale(1.2)' : 'scale(1)'
        }}
      >
        <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{pinSymbol}</span>
      </div>

      {isHovered && (
        <div 
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            padding: '12px',
            width: 'max-content',
            zIndex: 9999,
            color: '#ffffff',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span style={{ 
              fontWeight: 700, 
              color: isGoogle ? '#c084fc' : (event.backgroundColor || '#3b82f6')
            }}>
              {isGoogle ? 'Google' : `${event.extendedProps.priority || 'medium'} priority`}
            </span>
            {event.extendedProps.isCompleted && (
              <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600 }}>
                Done
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', wordBreak: 'break-word', marginTop: '2px' }}>
            {event.title.replace(/^📌\s+|^🌐\s+/, '')}
          </div>

          {event.start && (
            <div style={{ fontSize: '0.7rem', color: '#a0a0b0', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span>📅</span>
              <span>
                {new Date(event.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {!eventInfo.event.allDay && ` at ${new Date(event.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const renderEventContent = (eventInfo) => {
  const isMonthOrWeek = eventInfo.view.type === 'dayGridMonth' || eventInfo.view.type === 'timeGridWeek';
  if (isMonthOrWeek) {
    return <HoverablePin eventInfo={eventInfo} />;
  }
  return (
    <div style={{ padding: '2px 4px', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
      {eventInfo.event.title}
    </div>
  );
};

const CalendarFeed = ({ API_URL, refreshTrigger }) => {
  const [events, setEvents] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [refreshTrigger]);

  const fetchEvents = async () => {
    setIsSyncing(true);
    try {
      const localEvents = [];
      const googleEventsList = [];

      // 1. Fetch internal tasks
      const localRes = await axios.get(`${API_URL}/api/tasks/calendar-feed`, { withCredentials: true });
      const internalTasks = localRes.data.map(task => {
        // Set standard event details
        let eventColor = '#3b82f6'; // medium priority default
        if (task.priority === 'high') eventColor = '#f43f5e';
        else if (task.priority === 'low') eventColor = '#10b981';

        // Check if task has a time, format start date appropriately
        let start = task.dueDate;
        if (task.dueDate && task.dueTime) {
          const dateOnly = task.dueDate.split('T')[0];
          start = `${dateOnly}T${task.dueTime}:00`;
        }

        return {
          id: task._id,
          title: `📌 ${task.title}${task.isCompleted ? ' (Done)' : ''}`,
          start,
          allDay: !task.dueTime,
          backgroundColor: eventColor,
          borderColor: eventColor,
          textColor: '#ffffff',
          extendedProps: {
            source: 'local',
            priority: task.priority,
            isCompleted: task.isCompleted
          }
        };
      });

      // 2. Fetch Google Calendar events (optional)
      try {
        const googleRes = await axios.get(`${API_URL}/api/integrations/google-calendar/events`, { withCredentials: true });
        if (googleRes.data && googleRes.data.googleLinked) {
          setGoogleLinked(true);
          const externalEvents = googleRes.data.events.map(event => {
            const start = event.start.dateTime || event.start.date;
            const end = event.end.dateTime || event.end.date;
            
            return {
              id: event.id,
              title: `🌐 ${event.summary}`,
              start,
              end,
              allDay: !event.start.dateTime,
              backgroundColor: '#8b5cf6', // Indigo/purple for Google Calendar
              borderColor: '#8b5cf6',
              textColor: '#ffffff',
              extendedProps: {
                source: 'google',
                link: event.htmlLink
              }
            };
          });
          googleEventsList.push(...externalEvents);
        } else {
          setGoogleLinked(false);
        }
      } catch (gErr) {
        // Suppress Google calendar link errors gracefully
        setGoogleLinked(false);
        console.log("Google Calendar integration not connected or active.");
      }

      setEvents([...internalTasks, ...googleEventsList]);
    } catch (err) {
      console.error("Error fetching aggregated calendar events:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Drag-and-drop reschedule handler
  const handleEventDrop = async (info) => {
    const { id, extendedProps } = info.event;
    
    // ISO string format
    const newDateStr = info.event.start.toISOString().split('T')[0];
    const newTimeStr = info.event.start.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"

    try {
      if (extendedProps.source === 'local') {
        const updatePayload = {
          dueDate: newDateStr
        };
        // Only update time if not an all day event
        if (!info.event.allDay) {
          updatePayload.dueTime = newTimeStr;
        }

        await axios.patch(`${API_URL}/api/tasks/${id}`, updatePayload, { withCredentials: true });
        console.log("Local task date updated successfully.");
      } else if (extendedProps.source === 'google') {
        await axios.patch(`${API_URL}/api/integrations/google-calendar/events/${id}`, {
          newDate: newDateStr
        }, { withCredentials: true });
        console.log("Google Calendar event date updated successfully.");
      }
    } catch (err) {
      console.error("Failed to reschedule event:", err);
      info.revert();
      alert("Failed to reschedule event on server.");
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
          <Calendar size={22} className="text-purple" />
          Aggregated Calendar Schedule
        </h3>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {googleLinked && (
            <span style={{ fontSize: '0.75rem', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-purple)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              Google Calendar Sync Active
            </span>
          )}
          <button 
            onClick={fetchEvents} 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
            disabled={isSyncing}
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={events}
          editable={true}
          eventDrop={handleEventDrop}
          eventClick={(info) => {
            if (info.event.extendedProps.source === 'google' && info.event.extendedProps.link) {
              window.open(info.event.extendedProps.link, '_blank');
            }
          }}
          eventContent={renderEventContent}
          height="550px"
        />
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f43f5e' }}></span> High Priority
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }}></span> Medium Priority
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></span> Low Priority
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#8b5cf6' }}></span> Google Events
        </div>
      </div>
    </div>
  );
};

export default CalendarFeed;
