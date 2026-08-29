export function isRecoveryTokenUsable(input:{expiresAt:Date;usedAt:Date|null},now=new Date()){return input.usedAt===null&&input.expiresAt.getTime()>now.getTime();}
