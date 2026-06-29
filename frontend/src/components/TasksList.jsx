import React, { useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Calendar, Clock, UserPlus, Paperclip, Download, Check, RefreshCw } from 'lucide-react';

const TasksList = ({ API_URL, tasks, onTaskActionExecuted }) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [collaborators, setCollaborators] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isRecurringDaily, setIsRecurringDaily] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState('all'); // all, active, completed

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('priority', priority);
    formData.append('isRecurringDaily', isRecurringDaily);
    
    if (dueDate) formData.append('dueDate', dueDate);
    if (dueTime) formData.append('dueTime', dueTime);
    if (collaborators) formData.append('collaborators', collaborators);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    try {
      await axios.post(`${API_URL}/api/tasks`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      // Clear form
      setTitle('');
      setDueDate('');
      setDueTime('');
      setPriority('medium');
      setCollaborators('');
      setSelectedFiles([]);
      setIsRecurringDaily(false);
      onTaskActionExecuted();
    } catch (err) {
      console.error("Error creating task:", err);
      alert("Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = async (taskId, isCompleted) => {
    try {
      await axios.patch(`${API_URL}/api/tasks/${taskId}`, {
        isCompleted: !isCompleted
      }, { withCredentials: true });
      onTaskActionExecuted();
    } catch (err) {
      console.error("Error toggling completion:", err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/${taskId}`, { withCredentials: true });
      onTaskActionExecuted();
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'completed') return task.isCompleted;
    if (filter === 'active') return !task.isCompleted;
    return true;
  });

  return (
    <div className="glass-panel" style={{ height: '100%' }}>
      <h3 style={{ fontSize: '1.4rem', marginBottom: '20px' }}>Task Manager</h3>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['all', 'active', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '20px',
              background: filter === f ? 'var(--accent-purple-glow)' : 'transparent',
              borderColor: filter === f ? 'var(--accent-purple)' : 'var(--glass-border)',
              color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task Creation Form */}
      <form onSubmit={handleCreateTask} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Add new task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ flexGrow: 1 }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }} disabled={isSubmitting}>
            <Plus size={20} />
          </button>
        </div>

        {/* Extended options toggler details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Due Date</label>
            <input
              type="date"
              className="form-control"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Due Time</label>
            <input
              type="time"
              className="form-control"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Priority</label>
            <select
              className="form-control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <option value="high">🔴 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Collaborators (Email)</label>
            <input
              type="text"
              className="form-control"
              placeholder="friend@email.com"
              value={collaborators}
              onChange={(e) => setCollaborators(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Attachment files and Recurring checklist */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
          <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>
            <Paperclip size={14} /> Attach Files
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexGrow: 1 }}>
            {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'No files'}
          </span>

          <button
            type="button"
            onClick={() => setIsRecurringDaily(!isRecurringDaily)}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-sm)',
              background: isRecurringDaily ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
              borderColor: isRecurringDaily ? '#c084fc' : 'var(--glass-border)',
              color: isRecurringDaily ? '#ffffff' : 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} className={isRecurringDaily ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
            {isRecurringDaily ? '(Every Day): Active' : '(Every Day)'}
          </button>
        </div>
      </form>

      {/* Tasks List */}
      <div style={{ overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
        {filteredTasks.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            No tasks found.
          </p>
        ) : (
          filteredTasks.map(task => (
            <div 
              key={task._id} 
              className={`task-item priority-${task.priority} ${task.isCompleted ? 'completed' : ''}`}
            >
              <div className="task-checkbox-container">
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={task.isCompleted}
                  onChange={() => handleToggleComplete(task._id, task.isCompleted)}
                />
                
                <div className="task-details">
                  <h4 style={{ textDecoration: task.isCompleted ? 'line-through' : 'none' }}>
                    {task.title}
                  </h4>
                  
                  <div className="task-meta">
                    {task.dueDate && (
                      <span>
                        <Calendar size={12} style={{ color: '#c084fc' }} />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.dueTime && (
                      <span>
                        <Clock size={12} style={{ color: '#c084fc' }} />
                        {task.dueTime}
                      </span>
                    )}
                    {task.isRecurringDaily && (
                      <span style={{ color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw size={10} />
                        Every Day
                      </span>
                    )}
                    {task.collaborators && task.collaborators.length > 0 && (
                      <span>
                        <UserPlus size={12} />
                        {task.collaborators.length} shared
                      </span>
                    )}
                  </div>
                  
                  {/* File attachments download list */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {task.attachments.map(att => (
                        <a
                          key={att._id}
                          href={`${API_URL}/api/tasks/${task._id}/attachments/${att._id}`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--accent-blue)',
                            textDecoration: 'none',
                            border: '1px solid rgba(59,130,246,0.1)'
                          }}
                        >
                          <Download size={10} />
                          {att.filename.length > 15 ? att.filename.substring(0, 12) + '...' : att.filename}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="task-actions">
                <button 
                  onClick={() => handleDeleteTask(task._id)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', opacity: 0.7 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TasksList;
