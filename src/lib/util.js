// Petits utilitaires communs à la console et à l'aim trainer (lignes reprises de sources/aim-trainer.html).
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const hhmmss=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const rand=(a,b)=>a+Math.random()*(b-a);

export { $, pad, hhmmss, rand };
