import * as bcrypt from 'bcrypt';

const DEFAULT_SANT_ROUNDS = 10;

export function getNumberFromString(str: string) {
  return parseInt(str.replace(/^\D+/g, ''), 10);
}

export const sleep = (milisecondsTime: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milisecondsTime));

export const hashPasswordString = async (password) => {
  const saltRounds = DEFAULT_SANT_ROUNDS;
  const hashedPassword = await new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, function (err, hash) {
      if (err) reject(err);
      resolve(hash);
    });
  });
  return hashedPassword.toString();
};

export const comparePassword = async (plainPassword, hashPassword) => {
  const isMatch = await new Promise((resolve, reject) => {
    bcrypt.compare(plainPassword, hashPassword, function (err, result) {
      if (err) reject(err);
      resolve(result);
    });
  });
  return !!isMatch;
};

export const getFormattedDate = (date: Date) => {
  const year = date.getFullYear();

  let month = (1 + date.getMonth()).toString();
  month = month.length > 1 ? month : '0' + month;

  let day = date.getDate().toString();
  day = day.length > 1 ? day : '0' + day;

  return day + '/' + month + '/' + year;
};

export const getFormattedHourAndMinute = (date: Date) => {
  let extend = 'AM';
  let hour = date.getHours();
  if (hour == 0) {
    hour = 12;
  } else if (hour == 12) {
    extend = 'PM';
  } else if (hour > 12) {
    hour = hour - 12;
    extend = 'PM';
  }
  let hourString = hour.toString();
  hourString = hourString.length > 1 ? hourString : '0' + hourString;

  let minute = date.getMinutes().toString();
  minute = minute.length > 1 ? minute : '0' + minute;

  return hourString + ':' + minute + ' ' + extend;
};
