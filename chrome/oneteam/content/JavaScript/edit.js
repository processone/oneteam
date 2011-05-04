var EXPORTED_SYMBOLS = ["tooltip", "removeTooltip", "displayEditButton"];


function tooltip(htmlNode, xulNode, text) {
  /* this is to remedy the fact that in html elements embedded in xul, neither the
     html attribute 'title', nor the xul attributes 'tooltip' and 'tooltiptext' work.
     The solution consists in changing the attribute 'tooltiptext' of xulNode, which
     is logically an ancestor of htmlNode, when hovering or leaving htmlNode */

  removeTooltip(htmlNode);

  htmlNode.xulNode = xulNode;
  htmlNode.tooltiptext = text;
  htmlNode.mouseover = function() {
    xulNode.setAttribute("tooltiptext", text);
  }
  htmlNode.mouseout = function() {
    if (xulNode.getAttribute("tooltiptext") == text)
      xulNode.removeAttribute("tooltiptext");
  }
  htmlNode.addEventListener("mouseover", htmlNode.mouseover, true);
  htmlNode.addEventListener("mouseout", htmlNode.mouseout, true);
}

function removeTooltip(htmlNode) {
  htmlNode.removeEventListener("mouseover", htmlNode.mouseover, true);
  htmlNode.removeEventListener("mouseout", htmlNode.mouseout, true);
  if (htmlNode.xulNode &&
      htmlNode.xulNode.getAttribute("tooltiptext") == htmlNode.tooltiptext)
    htmlNode.xulNode.removeAttribute("tooltiptext");
}


function highlightDiff (node1, node2) {
  /* find out the text differences between nodes node1 and node2,
   * the differences being highlighted in <span class="edit">,
   * for example, 
   * node1 = "we live all in a <span class="yellow">yellow</span> submarine"
   * node2 = "We all live in a grey <span class="grey">submarine</span>"
   * htmlDiff(node1, node2) => (
   *   "We live <span class="edit">all</span> in a <span class="yellow"><span class="edit">yellow</span><span> submarine",
   *   "We <span class="edit">all</span> live in a <span class="edit">grey</span> <span class="grey">submarine</span>"
     ) 

     - turn spans class="edit" into textNodes
     - splits the text content of the nodes into arrays
     - finds out the diff between the arrays
     - insert the diffs into the nodes
   */
  var pattern = /\b/; // defines how to split the message into a strings array

  function _removeEditSpans(node) {
  // merges the content of span.edit into the parentNode, and remove span.edit
    var iterator = document.createNodeIterator(node, 1, {
        acceptNode: function(node) {
          return (node.tagName.toUpperCase() == "SPAN") && (node.className == "edit") ? 1 : 0;
        }
    }, true);
    var n;
    while ((n = iterator.nextNode())) {
      for (var i = 0; i < n.childNodes.length; i++)
        n.parentNode.insertBefore(n.childNodes[i], n);
      //n.nodeValue = ""; // unexpectedly, n.parentNode.removeChild(n) doesn't work properly
      n.parentNode.removeChild(n);
    }
    node.normalize();
  }

  function _split(node) {
    // split the textContent of node at spaces and html markups, returning an array of strings
    var res = [];
    var iterator = document.createNodeIterator(node, 4, {
        acceptNode: function() {return 1;}
    }, true);
    var n;
    while ((n = iterator.nextNode())) {
      res = res.concat(n.textContent.split(pattern));
    }
    return res;
  }

  function _diff (a1, a2) {
    var memo = []; // 2-dimensions tab to memoize results of lcs

    function lcs(x, y) {
      /* 0 <= x <= a1.length, 0 <= y <= a2.length
       * find out the longest common subsequence between a1.slice(0, x) and a2.slice(0, y)
       * and return the result as {
           w: the length of the LCS,
           b1: a boolean array (actually, a string containing 0 and 1, which is lighter)
               with true (1) if the corresponding word of a1 is in the LCS, false (0) else
           b2: idem for a2
         }
       */
      if (memo[x] == undefined)
        memo[x] = [];
      if (memo[x][y] == undefined) {
        if (x == 0)
          memo[x][y] = { b1: "", b2: (0).toFixed(y).substr(2), w: 0 }
        else if (y == 0)
          memo[x][y] = { b1: (0).toFixed(x).substr(2), b2: "", w: 0 }
        else if (a1[x-1] == a2[y-1]) {
          var m = lcs(x-1, y-1);
          memo[x][y] = { b1: m.b1 + "1", b2: m.b2 + "1", w:  m.w  + 1 };
        } else {
          var m1 = lcs(x, y-1),
              m2 = lcs(x-1, y);
          memo[x][y] = m1.w > m2.w ?
            { b1: m1.b1      , b2: m1.b2 + "0", w: m1.w } :
            { b1: m2.b1 + "0", b2: m2.b2      , w: m2.w } ;
        }
      }
      return memo[x][y];
    }
    
    return lcs(a1.length, a2.length);
  }

  function _unsplit(node, diffStr) {
    // given a node and diffStr found out by _diff,
    // modify node by adding <span class="edit"> markups at diverging parts of textContent
    var iterator = document.createNodeIterator(node, 4, {
        acceptNode: function() {return 1;}
    }, true);
    var i = 0, j, k, n;

    while ((n = iterator.nextNode())) {
      var text = n.textContent.split(pattern);
      j = 0;
      k = 0;
      while (k < text.length) {
        // looking for an undiverging sequence
        while (k < text.length && diffStr[i+k] == "1") k++;
        if (k>j) {
          n.parentNode.insertBefore(
            document.createTextNode(text.slice(j, k).join('')), n);
          j = k;
        }
        // looking for a diverging sequence
        while (k < text.length && diffStr[i+k] == "0") k++;
        if (k>j) {
          var span = node.ownerDocument.createElement("span");
          span.setAttribute("class", "edit");
          span.appendChild(node.ownerDocument.createTextNode(text.slice(j, k).join('')));
          n.parentNode.insertBefore(span, n);
          j = k;
        }
      }
      i += text.length;
      n.parentNode.removeChild(n);
    }
  }

  _removeEditSpans(node1);
  _removeEditSpans(node2);
  var diff = _diff(_split(node1), _split(node2));
  _unsplit(node1, diff.b1);
  _unsplit(node2, diff.b2);
}


function displayEditButton(body, originalMessage, xulNode) {
  // xulNode is used only to attach the tooltips to a xul element

  function mytooltip(htmlNode, text) {
    tooltip(htmlNode, xulNode, text);
  }

  var doc = body.ownerDocument;

  var button = doc.createElement("div");
  button.setAttribute("class", "displayEditButton");

  var previous = doc.createElement("div");
  previous.setAttribute("class", "previousMessage");
  button.appendChild(previous);

  var next = doc.createElement("div");
  next.setAttribute("class", "nextMessage");
  button.appendChild(next);

  var tooltipDiv;

  button.addEventListener("mouseover", function() {
    body.setAttribute("displayEdit", true);
  }, true);
  button.addEventListener("mouseout", function() {
    body.removeAttribute("displayEdit");
  }, true);

  var currentMsg = originalMessage;
  var nbVersions;

  function _updateTooltip() {
    mytooltip(tooltipDiv,
      nbVersions == 1 ? _("This message has been edited once") :
      nbVersions == 2 ? _("This message has been edited twice") :
                        _("This message has been edited {0} times", nbVersions)
    );
  }

  function _displayOtherVersion(msg) {
    // display the version in msg of the message instead of that in currentMsg

    // the handles with doc.body.scrollTop just aims to keep the bottom of doc.body
    // at the same level, even if jth version's height <> ith version's height
    var messageHeight = body.clientHeight,
        scrollShift = doc.body.scrollTop - doc.body.scrollHeight - messageHeight;
    // scrollHeightEnlarger is appended to doc.body to prevent doc.body's bottom to be 
    // over the chatpane-view's bottom: else, the scroll is automatically readjusted,
    // that takes time and the result is not fluid anymore
    var scrollHeightEnlarger = doc.createElement("div");
    scrollHeightEnlarger.setAttribute("style", "height: " + messageHeight + "px");

    highlightDiff(currentMsg.contentNode, msg.contentNode);

    // scrollHeightEnlarger is appended after highlightDiff, since highlightDiff may
    // take time: the complexity is O(n²) where n = number of words
    doc.body.appendChild(scrollHeightEnlarger);
    body.removeChild(currentMsg.contentNode);
    body.appendChild(msg.contentNode);

    doc.body.scrollTop = doc.body.scrollHeight + scrollShift;
    doc.body.removeChild(scrollHeightEnlarger);

    currentMsg = msg;
    _updateButtons();
  }

  function _displayPrevious() {
    _displayOtherVersion(currentMsg.previous);
  }
  function _displayNext() {
    _displayOtherVersion(currentMsg.editMessage);
  }

  function _updateButtons() {
    if (currentMsg.editCounter && currentMsg.editCounter > 0) {
      previous.removeAttribute("disabled");
      previous.addEventListener("click", _displayPrevious, true);
      mytooltip(previous, _('See Previous Version') + ", "
                          + readableTimestamp(currentMsg.previous.time));
    } else {
      previous.setAttribute("disabled", true);
      previous.removeEventListener("click", _displayPrevious, true);
      mytooltip(previous, _('This is the first version of the message'));
    }
    if (!currentMsg.editCounter || currentMsg.editCounter < nbVersions) {
      next.removeAttribute("disabled");
      next.addEventListener("click", _displayNext, true);
      mytooltip(next, _('See Next Version') + ", "
                      + readableTimestamp(currentMsg.editMessage.time));
    } else {
      next.setAttribute("disabled", true);
      next.removeEventListener("click", _displayNext, true);
      mytooltip(next, _('This is the last version of the message'));
    }
  }

  button.reload = function(msg) {
    if (currentMsg == msg)
      return;
    nbVersions = msg.editCounter;
    if (tooltipDiv)
      _updateTooltip();
    _displayOtherVersion(msg);
    _updateButtons();
  }

  button.setTooltipDiv = function() {
    if (!tooltipDiv) {
      tooltipDiv = doc.createElement("div");
      tooltipDiv.setAttribute("class", "tooltipDiv");
      button.appendChild(tooltipDiv);
    }
    _updateTooltip();
  }

  return button;
}
