export function appendChatTurn(thread,question){
 const turn=document.createElement('article');turn.className='chat-turn';
 const user=document.createElement('div');user.className='user-message';user.textContent=question;
 const reply=document.createElement('div');reply.className='assistant-message';
 turn.append(user,reply);thread.append(turn);return reply;
}
