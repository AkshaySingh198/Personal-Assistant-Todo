import assert from 'assert';

// Simulated heuristic voice parser from voice.controller.js
const heuristicVoiceParser = (text) => {
  const lowerText = text.toLowerCase().trim();
  const actions = [];

  // Check if it's a DELETE command
  if (lowerText.includes('delete') || lowerText.includes('remove') || lowerText.includes('cancel')) {
    if (lowerText.includes('everything') || lowerText.includes('all tasks') || lowerText.includes('all')) {
      let dateStr = new Date().toISOString().split('T')[0];
      if (lowerText.includes("tomorrow")) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
      }
      actions.push({
        actionType: "DELETE",
        targetScope: "ENTIRE_DAY",
        targetDate: dateStr
      });
    } else {
      let query = text.replace(/^(delete|remove|cancel)\s+/i, '').replace(/\btask\b/i, '').trim();
      actions.push({
        actionType: "DELETE",
        targetScope: "SINGLE_TASK",
        targetSearchQuery: query || "task"
      });
    }
  } 
  // Check if it's an UPDATE / COMPLETE command
  else if (lowerText.includes('done') || lowerText.includes('complete') || lowerText.includes('finish') || lowerText.includes('update') || lowerText.includes('change')) {
    let query = text.replace(/^(done|complete|finish|update|change)\s+/i, '').replace(/\btask\b/i, '').trim();
    
    let isCompleted = undefined;
    if (lowerText.includes('done') || lowerText.includes('complete') || lowerText.includes('finish')) {
      isCompleted = true;
      query = query.replace(/\b(done|complete|finish)\b/i, '').trim();
    }

    let priority = undefined;
    if (lowerText.includes('high')) priority = 'high';
    else if (lowerText.includes('medium')) priority = 'medium';
    else if (lowerText.includes('low')) priority = 'low';

    actions.push({
      actionType: "UPDATE",
      targetScope: "SINGLE_TASK",
      targetSearchQuery: query || "task",
      taskPayload: {
        isCompleted,
        priority
      }
    });
  } 
  // Default: Treat as CREATE command
  else {
    // Extract title (remove common verbs at the start of command)
    let title = text.replace(/^(add|create|new|plan|please|can you add|could you add|schedule|remind me to)\s+/i, '').trim();
    
    // Parse time, supporting both formats like "5 pm", "5pm", "17:30", "5:30 pm", "5:30pm"
    let time = "12:00";
    const timeMatch = lowerText.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      let minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Remove time pattern from title
      title = title.replace(/\bat\s+\d+(?::\d+)?\s*(am|pm)\b/i, '').trim();
    } else {
      // Look for HH:MM format (e.g. 15:30)
      const militaryTimeMatch = lowerText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (militaryTimeMatch) {
        time = `${militaryTimeMatch[1].padStart(2, '0')}:${militaryTimeMatch[2]}`;
        title = title.replace(/\bat\s+\b([01]?\d|2[0-3]):([0-5]\d)\b/i, '').trim();
      }
    }

    // Parse priority
    let priority = "medium";
    if (lowerText.includes("high priority") || lowerText.includes("important") || lowerText.includes("urgent")) {
      priority = "high";
      title = title.replace(/\b(high priority|important|urgent)\b/i, '').trim();
    } else if (lowerText.includes("low priority") || lowerText.includes("not important")) {
      priority = "low";
      title = title.replace(/\b(low priority|not important)\b/i, '').trim();
    }

    // Parse date (today / tomorrow / Monday etc.)
    let dateStr = new Date().toISOString().split('T')[0];
    if (lowerText.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateStr = tomorrow.toISOString().split('T')[0];
      title = title.replace(/\btomorrow\b/i, '').trim();
    } else if (lowerText.includes("today")) {
      title = title.replace(/\btoday\b/i, '').trim();
    }

    // Clean up trailing/leading spaces or punctuation in title
    title = title.replace(/^[,\s\-\:\.]+|[,\s\-\:\.]+$/g, '').trim();

    actions.push({
      actionType: "CREATE",
      targetScope: "SINGLE_TASK",
      taskPayload: {
        taskTitle: title || "New Voice Task",
        dueDate: dateStr,
        dueTime: time,
        priority,
        isCompleted: false
      }
    });
  }

  return { actions };
};

// Unit tests
const runTests = () => {
  console.log("Running voice intent parser unit tests...");

  // Test 1: Create Action
  const res1 = heuristicVoiceParser("Add project meeting at 4 PM high priority tomorrow");
  assert.strictEqual(res1.actions.length, 1);
  assert.strictEqual(res1.actions[0].actionType, "CREATE");
  assert.strictEqual(res1.actions[0].taskPayload.dueTime, "16:00");
  assert.strictEqual(res1.actions[0].taskPayload.priority, "high");
  
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  assert.strictEqual(res1.actions[0].taskPayload.dueDate, tomorrowStr);
  console.log("✓ Test 1: CREATE action parsing passed.");

  // Test 2: Delete Action
  const res2 = heuristicVoiceParser("Delete report writing task");
  assert.strictEqual(res2.actions.length, 1);
  assert.strictEqual(res2.actions[0].actionType, "DELETE");
  assert.strictEqual(res2.actions[0].targetSearchQuery, "report writing");
  console.log("✓ Test 2: DELETE action parsing passed.");

  console.log("All unit tests passed successfully!");
};

runTests();
