
export const WS_TOPIC = {
  TRACKING:  1,
  ALERT:     2,
  INCIDENT:  3,
  SIGNAL:    4,
  REROUTE:   5,   
  TASK:      6,
} as const;

export const WS_MESSAGE = {
  DEVICE_UPDATE:     1,
  ENTERED_ZONE:      1,
  EXITED_ZONE:       2,
  RECALLED:          3,
  ENTITY_INCIDENT:   4,
  ENTITY_RESCUE:     5,
  ENTITY_SOS:        6,
  SIGNAL_LOST:       7,
  SIGNAL_RECOVERED:  8,
  REROUTE_SUGGESTED: 9,   
  REROUTE_APPROVED:  10,  
  REROUTE_REJECTED:  11,  
  TASK_ASSIGNED:      12,
  TASK_UPDATED:     13,
} as const;