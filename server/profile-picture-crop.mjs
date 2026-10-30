export function portraitCrop(width,height,input={}){
 const x=Number(input.x??50),y=Number(input.y??50),zoom=Number(input.zoom??1);
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(zoom)||x<0||x>100||y<0||y>100||zoom<1||zoom>3)throw Error('Choose a valid picture alignment.');
 const side=Math.max(1,Math.floor(Math.min(width,height)/zoom));return {left:Math.round((width-side)*x/100),top:Math.round((height-side)*y/100),width:side,height:side};
}
