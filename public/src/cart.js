const costResult = document.getElementById('cost-summary');
const items = document.getElementsByClassName('cart-item');
const checkBoxes = document.getElementsByClassName('select-checkbox');
const itemPrices = document.getElementsByClassName('cart-price');
const bookIds = document.getElementsByClassName('book-id');
const cartIds = document.getElementsByClassName('cart-id');

function toFormatPoint(point) {
  return point.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

let selectedItems = []
let total = 0;
function updateCost() {
  selectedItems = []
  total = 0;
  for (var i = 0; i < checkBoxes.length; i++) {
    if (checkBoxes[i].checked) {
      total += Number(itemPrices[i].value);
      selectedItems.push({
        book_id: bookIds[i].value,
        cart_id: cartIds[i].value
      })
    }
  }
  costResult.innerText = "총 금액: " + toFormatPoint(total) + "원"
}

for (var i = 0; i < checkBoxes.length; i++) {
  checkBoxes[i].onclick = updateCost;
}

//
const limitMoney = Number(document.getElementById("money").value);
const limitPoint = Number(document.getElementById("point").value);
let useMoney = 0, usePoint = 0;
$("input#use-money").on("keyup", (event) => {
  useMoney = Number(event.target.value);
  if (total == 0) { return; }
  var maxMoney = total - usePoint;
  if (useMoney > maxMoney) {
    event.target.value = maxMoney;
    useMoney = maxMoney;
  }
  if (useMoney > limitMoney) {
    event.target.value = limitMoney;
    useMoney = limitMoney;
  }
  $('#final-cost')[0].innerText = `최종 결제 금액: ${useMoney + usePoint}원`;
})

$("input#use-point").on("keyup", (event) => {
  usePoint = Number(event.target.value);
  if (total == 0) { return; }
  var maxPoint = total - useMoney;
  if (usePoint > maxPoint) {
    event.target.value = maxPoint;
    usePoint = maxPoint;
  }
  if (usePoint > limitPoint) {
    event.target.value = limitPoint;
    usePoint = limitPoint;
  }
  $('#final-cost')[0].innerHTML = `최종 결제 금액: ${useMoney + usePoint}원`;
})


$('.checkout-btn').on('click', () => {
  $.ajax({
    type: "post",
    url: "/purchase",
    data: JSON.stringify(
      {
        selectedItems: selectedItems,
        usePoint: usePoint,
        useMoney: useMoney
      }
    ),
    contentType: 'application/json',
    success: function (data) {
      if (data.status == "error") {
        alert(data.message);
      } else {
        alert("구매 완료");
        document.location = data.next;
      }
    }
  })
})