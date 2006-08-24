function Animator(fade){
	if(fade)
		this.fadeSpeed = fade;
}
Animator.prototype = {
	opacity : 0,
	box : null,
	fadeSpeed : 20,
	step : function(anim) {
		anim.opacity++;
		anim.box.setAttribute("style", "-moz-opacity: " + anim.opacity/10);
		if(anim.opacity < 10) window.setTimeout(anim.step, anim.fadeSpeed, anim);
	},
	slideIn : function(anim) {
		try {
			var height = anim.box.boxObject.height;
			if (height == anim.oldHeight) {
			  delete anim.box.slideInTimeout;
			  return;
			}
	
			anim.oldHeight = height;
			height += 2;
			anim.box.style.maxHeight = height+"px";
			anim.box.slideInTimeout = setTimeout(anim.slideIn, 50, anim);
		}catch(e){dumpln("animate err");}
	},
	animate : function(box) {
		
		this.box = box;
		this.oldHeight = box.boxObject.height - 1;
		//this.step(this);
		this.slideIn(this);
	}

}
