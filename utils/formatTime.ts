// utils/formatTime.ts

export const formatTime = (time: number): string => {
    const hours = Math.floor(time / 100);
    const minutes = time % 100;
  
    // Validate minutes
    if (minutes >= 60 || minutes < 0) {
      console.warn(`Invalid minutes value: ${minutes} for time: ${time}`);
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
    }
  
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
  
    return `${displayHour}:${displayMinutes} ${period}`;
  };
  